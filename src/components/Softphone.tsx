import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, Mic, MicOff,
  Search, X, Minimize2, Maximize2, Clock, User, Upload
} from "lucide-react";
import { cn } from "@/lib/utils";

type Consumer = { id: string; name: string; phone: string | null; service_number: string };

type CallState = "idle" | "dialing" | "connected" | "wrap_up";

const DIAL_PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

const DISPOSITIONS = [
  "complaint_registered", "information_provided", "billing_clarification",
  "escalated_to_field", "duplicate_complaint", "call_dropped", "wrong_number", "no_response",
] as const;

export function Softphone() {
  const { session, role } = useAuth();
  const [minimized, setMinimized] = useState(true);
  const [callState, setCallState] = useState<CallState>("idle");
  const [dialNumber, setDialNumber] = useState("");
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(null);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [disposition, setDisposition] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [recording, setRecording] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Consumer[]>([]);
  const [interactionId, setInteractionId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<string | null>(null);

  // Consumer search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("consumers")
        .select("id, name, phone, service_number")
        .or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,service_number.ilike.%${searchQuery}%`)
        .limit(6);
      setSearchResults((data || []).filter(c => c.phone));
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Timer
  useEffect(() => {
    if (callState === "connected") {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleDial = (digit: string) => {
    setDialNumber(prev => prev + digit);
  };

  const startCall = useCallback(async () => {
    if (!session?.user?.id) { toast.error("Please log in first"); return; }
    const number = selectedConsumer?.phone || dialNumber;
    if (!number) { toast.error("Enter a phone number or select a consumer"); return; }

    setCallState("dialing");
    toast.info("Initiating call via Twilio...");

    try {
      // Initiate call via Twilio edge function
      const { data: twilioRes, error: fnError } = await supabase.functions.invoke("twilio-call", {
        body: { action: "call", to: number },
      });

      if (fnError) throw new Error(fnError.message);
      if (!twilioRes?.success) throw new Error(twilioRes?.error || "Call initiation failed");

      // Create interaction record
      startTimeRef.current = new Date().toISOString();
      const { data, error } = await supabase.from("interactions").insert({
        agent_id: session.user.id,
        consumer_id: selectedConsumer?.id || null,
        direction,
        type: "call",
        started_at: startTimeRef.current,
        duration_seconds: 0,
      }).select("id").single();

      if (error) { toast.error("Failed to log call: " + error.message); return; }

      setInteractionId(data.id);
      setCallState("connected");
      setElapsed(0);
      toast.success(`Call connected — SID: ${twilioRes.callSid?.slice(-6)}`);
    } catch (err: any) {
      setCallState("idle");
      toast.error("Call failed: " + (err.message || "Unknown error"));
    }
  }, [session, selectedConsumer, dialNumber, direction]);

  const endCall = useCallback(async () => {
    if (interactionId) {
      await supabase.from("interactions").update({
        ended_at: new Date().toISOString(),
        duration_seconds: elapsed,
      }).eq("id", interactionId);
    }
    setCallState("wrap_up");
    toast.info("Call ended — please complete the wrap-up form");
  }, [interactionId, elapsed]);

  const submitWrapUp = useCallback(async () => {
    if (!disposition) { toast.error("Please select a disposition"); return; }
    if (!remarks.trim()) { toast.error("Please enter remarks"); return; }

    let recordingRef: string | null = null;

    // Upload recording if provided
    if (recording && interactionId) {
      const ext = recording.name.split(".").pop();
      const path = `${interactionId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("call-recordings")
        .upload(path, recording);
      if (uploadError) {
        toast.error("Recording upload failed: " + uploadError.message);
      } else {
        recordingRef = path;
      }
    }

    if (interactionId) {
      await supabase.from("interactions").update({
        disposition: disposition as any,
        remarks,
        call_recording_ref: recordingRef,
      }).eq("id", interactionId);
    }

    // Update agent status
    if (session?.user?.id) {
      await supabase.from("profiles").update({ status: "ready" }).eq("user_id", session.user.id);
    }

    toast.success("Call logged successfully");
    resetState();
  }, [disposition, remarks, recording, interactionId, session]);

  const resetState = () => {
    setCallState("idle");
    setDialNumber("");
    setSelectedConsumer(null);
    setElapsed(0);
    setDisposition("");
    setRemarks("");
    setRecording(null);
    setInteractionId(null);
    setSearchQuery("");
    setSearchResults([]);
    setMuted(false);
  };

  const selectConsumer = (c: Consumer) => {
    setSelectedConsumer(c);
    setDialNumber(c.phone || "");
    setSearchQuery("");
    setSearchResults([]);
  };

  // Only show for supervisor and admin roles — agents use AgentPanel
  if (role === "agent") return null;

  const stateColor = {
    idle: "bg-muted",
    dialing: "bg-warning/20",
    connected: "bg-success/20",
    wrap_up: "bg-accent",
  };

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setMinimized(false)}
          className={cn(
            "h-14 w-14 rounded-full shadow-lg transition-all",
            callState === "connected" && "animate-pulse bg-success hover:bg-success/90",
            callState === "wrap_up" && "bg-warning hover:bg-warning/90",
            callState === "idle" && "bg-primary hover:bg-primary/90",
          )}
        >
          <Phone className="h-6 w-6" />
          {callState === "connected" && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold h-5 w-5 flex items-center justify-center">
              {formatTime(elapsed).split(":")[0]}
            </span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-[scaleIn_0.2s_ease-out]">
      {/* Header */}
      <div className={cn("px-4 py-3 flex items-center justify-between transition-colors", stateColor[callState])}>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-foreground" />
          <span className="text-sm font-semibold text-foreground">Softphone</span>
          {callState === "connected" && (
            <Badge variant="outline" className="text-xs bg-success/20 text-success border-success/30">
              <Clock className="h-3 w-3 mr-1" />{formatTime(elapsed)}
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMinimized(true)}>
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
        {/* IDLE / DIALING STATE */}
        {(callState === "idle" || callState === "dialing") && (
          <>
            {/* Consumer search */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search consumer..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="border border-border rounded-md overflow-hidden max-h-32 overflow-y-auto">
                  {searchResults.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectConsumer(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b border-border last:border-0 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{c.service_number}</span>
                      </div>
                      <span className="text-xs text-primary">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected consumer */}
            {selectedConsumer && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-accent/50 text-sm">
                <User className="h-4 w-4 text-accent-foreground" />
                <span className="font-medium text-accent-foreground">{selectedConsumer.name}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => { setSelectedConsumer(null); setDialNumber(""); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Number display */}
            <Input
              value={dialNumber}
              onChange={e => setDialNumber(e.target.value)}
              placeholder="Phone number"
              className="text-center text-lg font-mono tracking-widest h-11"
            />

            {/* Dial pad */}
            <div className="grid grid-cols-3 gap-1.5">
              {DIAL_PAD.map(d => (
                <Button
                  key={d}
                  variant="outline"
                  className="h-10 text-lg font-medium hover:bg-primary/10"
                  onClick={() => handleDial(d)}
                >
                  {d}
                </Button>
              ))}
            </div>

            {/* Direction toggle */}
            <div className="flex gap-2">
              <Button
                variant={direction === "outbound" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setDirection("outbound")}
              >
                <PhoneOutgoing className="h-3 w-3 mr-1" />Outbound
              </Button>
              <Button
                variant={direction === "inbound" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setDirection("inbound")}
              >
                <PhoneIncoming className="h-3 w-3 mr-1" />Inbound
              </Button>
            </div>

            {/* Call button */}
            <Button
              onClick={startCall}
              className="w-full bg-success hover:bg-success/90 text-success-foreground"
              disabled={!dialNumber && !selectedConsumer}
            >
              <Phone className="h-4 w-4 mr-2" />Start Call
            </Button>
          </>
        )}

        {/* CONNECTED STATE */}
        {callState === "connected" && (
          <>
            <div className="text-center space-y-2">
              {selectedConsumer && (
                <div className="flex items-center justify-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{selectedConsumer.name}</span>
                </div>
              )}
              <div className="text-3xl font-mono font-bold text-success">{formatTime(elapsed)}</div>
              <p className="text-sm text-muted-foreground">{dialNumber}</p>
              <div className="flex items-center justify-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-success font-medium">Connected</span>
              </div>
            </div>

            <div className="flex gap-2 justify-center">
              <Button
                variant={muted ? "destructive" : "outline"}
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={() => setMuted(!muted)}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={endCall}
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>
          </>
        )}

        {/* WRAP-UP STATE */}
        {callState === "wrap_up" && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Call Ended</p>
              <p className="text-xs text-muted-foreground">Duration: {formatTime(elapsed)} • {direction}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Disposition *</Label>
              <Select value={disposition} onValueChange={setDisposition}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select disposition..." />
                </SelectTrigger>
                <SelectContent>
                  {DISPOSITIONS.map(d => (
                    <SelectItem key={d} value={d}>{d.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Remarks *</Label>
              <Textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Enter call remarks..."
                className="text-sm min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Call Recording (optional)</Label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    {recording ? recording.name : "Upload recording..."}
                  </div>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={e => setRecording(e.target.files?.[0] || null)}
                  />
                </label>
                {recording && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRecording(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-xs" onClick={resetState}>
                Skip
              </Button>
              <Button className="flex-1 text-xs" onClick={submitWrapUp}>
                Submit & Ready
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
