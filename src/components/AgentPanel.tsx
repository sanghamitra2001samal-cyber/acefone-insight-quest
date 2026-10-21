import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Phone, PhoneOff, Mic, MicOff, Pause, Play, Circle, PhoneForwarded,
  Hash, Clock, User, Headphones, Keyboard, AlertCircle, LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";

type Consumer = {
  id: string; name: string; phone: string | null; service_number: string;
  address: string | null; email: string | null;
};

type CallState = "idle" | "ringing" | "connected" | "wrap_up";

const DISPOSITIONS = [
  "complaint_registered", "information_provided", "billing_clarification",
  "escalated_to_field", "duplicate_complaint", "call_dropped", "wrong_number", "no_response",
] as const;

const PAUSE_CODES = ["Break", "Lunch", "Training", "Meeting", "Personal"] as const;

interface AgentPanelProps {
  fullScreen?: boolean;
}

export function AgentPanel({ fullScreen = false }: AgentPanelProps) {
  const { session, profile, role, signOut } = useAuth();
  const [callState, setCallState] = useState<CallState>("idle");
  const [agentStatus, setAgentStatus] = useState<"paused" | "ready" | "busy">("paused");
  const [elapsed, setElapsed] = useState(0);
  const [sessionTime, setSessionTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [hotkeysEnabled, setHotkeysEnabled] = useState(false);

  // Customer form
  const [title, setTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [address3, setAddress3] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postCode, setPostCode] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [consumerId, setConsumerId] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [email, setEmail] = useState("");
  const [comments, setComments] = useState("");

  // Wrap-up
  const [disposition, setDisposition] = useState("");
  const [remarks, setRemarks] = useState("");
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(null);

  // Manual dial (supervisor)
  const [manualDialNumber, setManualDialNumber] = useState("");
  const [showManualDial, setShowManualDial] = useState(false);

  // DTMF
  const [dtmfInput, setDtmfInput] = useState("");

  // Pause code
  const [showPauseCode, setShowPauseCode] = useState(false);
  const [pauseCode, setPauseCode] = useState("");

  // Queue & callbacks
  const [queueCount, setQueueCount] = useState(0);
  const [callbackCount, setCallbackCount] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<string | null>(null);

  // Session timer
  useEffect(() => {
    sessionTimerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
    return () => { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current); };
  }, []);

  // Call timer
  useEffect(() => {
    if (callState === "connected") {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const updateAgentStatus = useCallback(async (status: string) => {
    if (session?.user?.id) {
      await supabase.from("profiles").update({ status: status as any }).eq("user_id", session.user.id);
    }
  }, [session]);

  const handlePause = useCallback(async (code?: string) => {
    setAgentStatus("paused");
    setPauseCode(code || "Break");
    await updateAgentStatus("break");
    toast.info(`Paused — ${code || "Break"}`);
    setShowPauseCode(false);
  }, [updateAgentStatus]);

  const handleResume = useCallback(async () => {
    setAgentStatus("ready");
    setPauseCode("");
    await updateAgentStatus("ready");
    toast.success("Ready — Waiting for calls");
  }, [updateAgentStatus]);

  // Simulate accepting an inbound call (in real system, webhook would trigger this)
  const simulateInboundCall = useCallback(async (consumerPhone?: string) => {
    if (agentStatus !== "ready") {
      toast.error("You must be in READY status to receive calls");
      return;
    }
    setCallState("ringing");
    setAgentStatus("busy");
    await updateAgentStatus("busy");

    // Try to find consumer by phone
    if (consumerPhone) {
      const { data } = await supabase
        .from("consumers")
        .select("id, name, phone, service_number, address, email")
        .eq("phone", consumerPhone)
        .limit(1)
        .single();
      if (data) populateConsumerForm(data);
    }

    // Auto-answer after 1.5s
    setTimeout(async () => {
      startTimeRef.current = new Date().toISOString();
      const { data, error } = await supabase.from("interactions").insert({
        agent_id: session!.user.id,
        consumer_id: selectedConsumer?.id || null,
        direction: "inbound",
        type: "call",
        started_at: startTimeRef.current,
        duration_seconds: 0,
      }).select("id").single();

      if (!error && data) setInteractionId(data.id);
      setCallState("connected");
      setElapsed(0);
      toast.success("Call connected");
    }, 1500);
  }, [agentStatus, session, selectedConsumer, updateAgentStatus]);

  const populateConsumerForm = (c: Consumer) => {
    setSelectedConsumer(c);
    const nameParts = c.name.split(" ");
    setFirstName(nameParts[0] || "");
    setLastName(nameParts.slice(1).join(" ") || "");
    setServiceNumber(c.service_number);
    setConsumerId(c.id.slice(0, 8));
    setPhone(c.phone || "");
    setEmail(c.email || "");
    const addrParts = (c.address || "").split(",").map(s => s.trim());
    setAddress1(addrParts[0] || "");
    setAddress2(addrParts[1] || "");
    setCity(addrParts[2] || "");
    setState(addrParts[3] || "");
    setPostCode(addrParts[4] || "");
  };

  const handleHangup = useCallback(async () => {
    if (interactionId) {
      await supabase.from("interactions").update({
        ended_at: new Date().toISOString(),
        duration_seconds: elapsed,
        consumer_id: selectedConsumer?.id || null,
      }).eq("id", interactionId);
    }
    setCallState("wrap_up");
    toast.info("Call ended — Complete wrap-up");
  }, [interactionId, elapsed, selectedConsumer]);

  const submitWrapUp = useCallback(async () => {
    if (!disposition) { toast.error("Select a disposition"); return; }
    if (!remarks.trim()) { toast.error("Enter remarks"); return; }

    if (interactionId) {
      const mergedRemarks = comments.trim()
        ? `[Agent Comments]: ${comments.trim()}${remarks.trim() ? `\n[Wrap-up Remarks]: ${remarks.trim()}` : ""}`
        : remarks.trim();

      await supabase.from("interactions").update({
        disposition: disposition as any,
        remarks: mergedRemarks,
      }).eq("id", interactionId);
    }

    toast.success("Call logged successfully");
    resetCallState();
    setAgentStatus("ready");
    await updateAgentStatus("ready");
  }, [disposition, remarks, comments, interactionId, updateAgentStatus]);

  const resetCallState = () => {
    setCallState("idle");
    setElapsed(0);
    setDisposition("");
    setRemarks("");
    setInteractionId(null);
    setSelectedConsumer(null);
    setMuted(false);
    setRecording(false);
    setTitle(""); setFirstName(""); setMiddleInitial(""); setLastName("");
    setAddress1(""); setAddress2(""); setAddress3("");
    setCity(""); setState(""); setPostCode("");
    setServiceNumber(""); setConsumerId(""); setPhone(""); setAltPhone(""); setEmail("");
    setComments("");
  };

  // Manual dial for supervisors
  const handleManualDial = useCallback(async () => {
    if (!manualDialNumber) { toast.error("Enter a number"); return; }
    try {
      const { data, error } = await supabase.functions.invoke("twilio-call", {
        body: { action: "call", to: manualDialNumber },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Call failed");

      setPhone(manualDialNumber);
      setCallState("connected");
      setAgentStatus("busy");
      await updateAgentStatus("busy");
      startTimeRef.current = new Date().toISOString();

      const { data: intData } = await supabase.from("interactions").insert({
        agent_id: session!.user.id,
        direction: "outbound",
        type: "call",
        started_at: startTimeRef.current,
        duration_seconds: 0,
      }).select("id").single();

      if (intData) setInteractionId(intData.id);
      setElapsed(0);
      setShowManualDial(false);
      setManualDialNumber("");
      toast.success("Outbound call connected");
    } catch (err: any) {
      toast.error("Call failed: " + err.message);
    }
  }, [manualDialNumber, session, updateAgentStatus]);

  // Consumer search by service number
  const searchByServiceNumber = useCallback(async () => {
    if (!serviceNumber) return;
    const { data } = await supabase
      .from("consumers")
      .select("id, name, phone, service_number, address, email")
      .eq("service_number", serviceNumber)
      .limit(1)
      .single();
    if (data) {
      populateConsumerForm(data);
      toast.success("Consumer found");
    } else {
      toast.info("No consumer found with that service number");
    }
  }, [serviceNumber]);

  const statusColor = agentStatus === "ready" ? "bg-success" : agentStatus === "busy" ? "bg-destructive" : "bg-warning";
  const statusLabel = agentStatus === "ready" ? "READY" : agentStatus === "busy" ? "ON CALL" : `PAUSED${pauseCode ? ` - ${pauseCode}` : ""}`;

  return (
    <div className={cn("flex flex-col overflow-hidden bg-card", fullScreen ? "h-screen" : "h-full border border-border rounded-lg")}>
      {/* TOP STATUS BAR */}
      <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between text-sm flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Headphones className="h-4 w-4" />
          <span className="font-bold tracking-wide">TGSPDCL Call Center</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span className="font-medium">{profile?.full_name || "Agent"}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Session: {formatTime(sessionTime)}
          </span>
          <span>Queue: {queueCount}</span>
          <Badge variant={callState === "connected" ? "destructive" : "secondary"} className="text-xs">
            {callState === "connected" ? "LIVE CALL" : callState === "ringing" ? "RINGING" : "NO LIVE CALL"}
          </Badge>
          <span className="font-mono font-bold">{callState === "connected" ? formatTime(elapsed) : "00:00:00"}</span>
          <div className={cn("h-3 w-3 rounded-full", statusColor)} title={statusLabel} />
          <span className="text-xs font-medium">{statusLabel}</span>
          {fullScreen && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-primary-foreground hover:bg-primary-foreground/20 h-7"
              onClick={signOut}
            >
              <LogOut className="h-3 w-3 mr-1" />Sign Out
            </Button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT CONTROLS */}
        <div className="w-56 border-r border-border p-3 flex flex-col gap-2 bg-muted/30 shrink-0">
          {/* Pause / Resume */}
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant={agentStatus === "paused" ? "default" : "outline"}
              className="flex-1 text-xs"
              onClick={() => setShowPauseCode(true)}
              disabled={callState === "connected" || callState === "ringing"}
            >
              <Pause className="h-3 w-3 mr-1" />PAUSE
            </Button>
            <Button
              size="sm"
              variant={agentStatus === "ready" ? "default" : "outline"}
              className="flex-1 text-xs"
              onClick={handleResume}
              disabled={callState === "connected" || callState === "ringing"}
            >
              <Play className="h-3 w-3 mr-1" />RESUME
            </Button>
          </div>

          {/* Pause code selector */}
          {showPauseCode && (
            <div className="border border-border rounded-md p-2 bg-card space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Select Pause Code:</p>
              {PAUSE_CODES.map(code => (
                <Button
                  key={code} size="sm" variant="ghost"
                  className="w-full justify-start text-xs h-7"
                  onClick={() => handlePause(code)}
                >
                  {code}
                </Button>
              ))}
            </div>
          )}

          <div className="border-t border-border my-1" />

          {/* Call info */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer Time:</span>
              <span className="font-mono">{callState === "connected" ? formatTime(elapsed) : "--:--"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Channel:</span>
              <span>Phone</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Record ID:</span>
              <span className="font-mono">{interactionId?.slice(0, 8) || "N/A"}</span>
            </div>
          </div>

          <div className="border-t border-border my-1" />

          {/* Recording */}
          <Button
            size="sm"
            variant={recording ? "destructive" : "outline"}
            className="text-xs w-full"
            onClick={() => setRecording(!recording)}
            disabled={callState !== "connected"}
          >
            <Circle className={cn("h-3 w-3 mr-1", recording && "fill-current")} />
            {recording ? "RECORDING" : "START RECORDING"}
          </Button>

          {/* Hangup */}
          <Button
            size="sm"
            variant="destructive"
            className="text-xs w-full"
            onClick={handleHangup}
            disabled={callState !== "connected"}
          >
            <PhoneOff className="h-3 w-3 mr-1" />HANGUP CUSTOMER
          </Button>

          {/* Transfer */}
          <Button
            size="sm"
            variant="outline"
            className="text-xs w-full"
            disabled={callState !== "connected"}
          >
            <PhoneForwarded className="h-3 w-3 mr-1" />TRANSFER - CONF
          </Button>

          {/* DTMF */}
          <div className="flex gap-1">
            <Input
              placeholder="DTMF"
              value={dtmfInput}
              onChange={e => setDtmfInput(e.target.value)}
              className="h-8 text-xs"
              disabled={callState !== "connected"}
            />
            <Button size="sm" variant="outline" className="h-8 text-xs px-2" disabled={callState !== "connected"}>
              <Hash className="h-3 w-3" />
            </Button>
          </div>

          {/* Simulate inbound (for testing) */}
          <div className="border-t border-border my-1" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Test Controls</p>
          <Button
            size="sm"
            variant="secondary"
            className="text-xs w-full"
            onClick={() => simulateInboundCall()}
            disabled={agentStatus !== "ready" || callState !== "idle"}
          >
            <Phone className="h-3 w-3 mr-1" />Simulate Inbound
          </Button>
        </div>

        {/* CENTER — CUSTOMER FORM or WRAP-UP */}
        <div className="flex-1 p-4 overflow-y-auto">
          {callState === "wrap_up" ? (
            <div className="max-w-lg mx-auto space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">Call Wrap-Up</h3>
                <p className="text-sm text-muted-foreground">Duration: {formatTime(elapsed)}</p>
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
                  className="text-sm min-h-[80px]"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { resetCallState(); setAgentStatus("ready"); updateAgentStatus("ready"); }}>
                  Skip
                </Button>
                <Button className="flex-1" onClick={submitWrapUp}>
                  Submit & Ready
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Customer Information</h3>
                {selectedConsumer && (
                  <Badge variant="secondary" className="text-xs">
                    Matched: {selectedConsumer.name}
                  </Badge>
                )}
              </div>

              {/* Row 1: Service Number & Consumer search */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Service Number</Label>
                  <div className="flex gap-1">
                    <Input value={serviceNumber} onChange={e => setServiceNumber(e.target.value)} className="h-8 text-sm" placeholder="SVC-XXXXXX" />
                    <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={searchByServiceNumber}>
                      Find
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Consumer ID</Label>
                  <Input value={consumerId} onChange={e => setConsumerId(e.target.value)} className="h-8 text-sm" readOnly />
                </div>
              </div>

              {/* Row 2: Name */}
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <Select value={title} onValueChange={setTitle}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="--" /></SelectTrigger>
                    <SelectContent>
                      {["Mr", "Mrs", "Ms", "Dr"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">First Name</Label>
                  <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">M.I.</Label>
                  <Input value={middleInitial} onChange={e => setMiddleInitial(e.target.value)} className="h-8 text-sm" maxLength={1} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Last Name</Label>
                  <Input value={lastName} onChange={e => setLastName(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>

              {/* Row 3: Address */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Address 1</Label>
                <Input value={address1} onChange={e => setAddress1(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Address 2</Label>
                  <Input value={address2} onChange={e => setAddress2(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Address 3</Label>
                  <Input value={address3} onChange={e => setAddress3(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>

              {/* Row 4: City, State, PostCode */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">City</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">State</Label>
                  <Input value={state} onChange={e => setState(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Pin Code</Label>
                  <Input value={postCode} onChange={e => setPostCode(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>

              {/* Row 5: Phone, Alt Phone, Email */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Alt. Phone</Label>
                  <Input value={altPhone} onChange={e => setAltPhone(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>

              {/* Comments */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Comments</Label>
                <Textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  className="text-sm min-h-[60px]"
                  placeholder="Enter notes during the call..."
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="border-t border-border bg-muted/30 px-4 py-2 flex items-center gap-3 flex-wrap">
        {/* Manual Dial — supervisor only */}
        {(role === "supervisor" || role === "admin") && (
          <>
            {showManualDial ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={manualDialNumber}
                  onChange={e => setManualDialNumber(e.target.value)}
                  placeholder="Enter number..."
                  className="h-8 w-40 text-sm"
                />
                <Button size="sm" className="h-8 text-xs" onClick={handleManualDial}>
                  <Phone className="h-3 w-3 mr-1" />Dial
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowManualDial(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setShowManualDial(true)}
                disabled={callState === "connected"}
              >
                <Phone className="h-3 w-3 mr-1" />MANUAL DIAL
              </Button>
            )}
            <div className="h-5 w-px bg-border" />
          </>
        )}

        {/* Pause code display */}
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={() => setShowPauseCode(!showPauseCode)}
        >
          <AlertCircle className="h-3 w-3 mr-1" />
          {pauseCode || "PAUSE CODE"}
        </Button>

        <div className="h-5 w-px bg-border" />

        {/* Callbacks */}
        <Button size="sm" variant="ghost" className="text-xs">
          Callbacks: {callbackCount}
        </Button>

        <div className="h-5 w-px bg-border" />

        {/* Hotkeys */}
        <Button
          size="sm"
          variant={hotkeysEnabled ? "default" : "ghost"}
          className="text-xs"
          onClick={() => setHotkeysEnabled(!hotkeysEnabled)}
        >
          <Keyboard className="h-3 w-3 mr-1" />HOT KEYS {hotkeysEnabled ? "ON" : "OFF"}
        </Button>

        <div className="flex-1" />

        {/* Mute */}
        <Button
          size="sm"
          variant={muted ? "destructive" : "outline"}
          className="text-xs"
          onClick={() => setMuted(!muted)}
          disabled={callState !== "connected"}
        >
          {muted ? <MicOff className="h-3 w-3 mr-1" /> : <Mic className="h-3 w-3 mr-1" />}
          {muted ? "UNMUTE" : "MUTE"}
        </Button>
      </div>
    </div>
  );
}
