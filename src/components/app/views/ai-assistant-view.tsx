"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  createSpeechRecognizer,
  speakText,
  stopSpeaking,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
} from "@/lib/ai/speech";
import type { AIChatResponse, ListingCitation, SuggestedAction } from "@/lib/ai/types";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ShieldAlert,
  PhoneCall,
  ChevronRight,
  ArrowLeft,
  Bot,
  User as UserIcon,
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  citations?: ListingCitation[];
  suggestedActions?: SuggestedAction[];
  emergencyNotice?: AIChatResponse["emergencyNotice"];
}

export function AiAssistantView() {
  const { lang, setLang, navigate, openBookingAuthModal, user } = useApp();
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, "up" | "down">>({});
  const [conversationId, setConversationId] = useState<string>(() => `conv_${Date.now()}`);

  const speechRecognizerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const initialGreeting =
    lang === "te"
      ? "నమస్కారం! గోదావరి వన్ అధికారిక డిజిటల్ అసిస్టెంట్‌కి స్వాగతం. గోదావరి పుష్కరాలు 2027 ఘాట్‌లు, ఉచిత వసతి సత్రాలు, అన్నదానం, హోటళ్లు మరియు పురోహితుల వివరాలు నన్ను అడగండి."
      : "Namaskaram! Welcome to Godavari One. I am your comprehensive digital guide for Godavari Pushkaralu 2027. Ask me anything about ghats, live crowd conditions, free accommodation, Annadanam, hotels, or certified purohits.";

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-greeting",
      sender: "assistant",
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const quickQuestions =
    lang === "te"
      ? [
          "రాజమండ్రిలో ఉచిత సత్రాలు ఎక్కడ ఉన్నాయి?",
          "ప్రస్తుతం ఏ ఘాట్లలో రద్దీ తక్కువగా ఉంది?",
          "పిండ ప్రదానం కోసం పురోహితుడిని ఎలా బుక్ చేసుకోవాలి?",
          "అత్యవసర ఆసుపత్రులు మరియు హెల్ప్‌లైన్లు ఏమిటి?",
        ]
      : [
          "Which ghats have low crowd right now?",
          "Where can I find free accommodation?",
          "How do I book a certified Purohit for rituals?",
          "Find nearby emergency hospitals",
        ];

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId,
          language: lang,
        }),
      });

      if (!res.ok) throw new Error("Request failed");

      const data: AIChatResponse = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: `ast_${Date.now()}`,
          sender: "assistant",
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          citations: data.citations,
          suggestedActions: data.suggestedActions,
          emergencyNotice: data.emergencyNotice,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "assistant",
          text:
            lang === "te"
              ? "క్షమించండి, మీ అభ్యర్థనను ప్రాసెస్ చేయడంలో సాంకేతిక సమస్య ఏర్పడింది. దయచేసి డైరెక్టరీ ద్వారా వెతకండి."
              : "I apologize, there was an issue processing your request. Please explore our verified listings directly through the directory menu.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleVoiceInput() {
    if (!isSpeechRecognitionSupported()) {
      toast({
        title: "Voice Not Supported",
        description: "Your browser does not support Web Speech Recognition.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      speechRecognizerRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognizer = createSpeechRecognizer({
      language: lang,
      onResult: (res) => setInputMessage(res.transcript),
      onError: (err) => {
        setIsListening(false);
        toast({ title: "Voice Input", description: err, variant: "destructive" });
      },
      onEnd: () => setIsListening(false),
    });

    if (recognizer) {
      speechRecognizerRef.current = recognizer;
      try {
        recognizer.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  }

  function handleReadAloud(msgId: string, text: string) {
    if (speakingMsgId === msgId) {
      stopSpeaking();
      setSpeakingMsgId(null);
      return;
    }

    stopSpeaking();
    setSpeakingMsgId(msgId);
    speakText(text, lang, () => setSpeakingMsgId(null));
  }

  function handleCopy(msgId: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopiedId(msgId);
    toast({ title: "Copied", description: "Response copied to clipboard." });
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleActionClick(action: SuggestedAction) {
    if (action.type === "CALL_EMERGENCY") {
      window.open(`tel:${action.payload.tel || "108"}`, "_self");
    } else if (action.type === "NAVIGATE_CATEGORY") {
      navigate({ name: "directory", category: action.payload.category });
    } else if (action.type === "VIEW_LISTING") {
      navigate({ name: "listing", id: action.payload.listingId });
    } else if (action.type === "BOOK_LISTING") {
      if (!user) {
        openBookingAuthModal({
          context: {
            type: action.payload.category || "HOTEL",
            title: "Booking Sign In Required",
            details: "Please sign in to proceed with your booking.",
            data: action.payload,
          },
          onAuthenticated: () => {
            navigate({ name: "listing", id: action.payload.listingId });
          },
        });
      } else {
        navigate({ name: "listing", id: action.payload.listingId });
      }
    }
  }

  function handleResetChat() {
    stopSpeaking();
    setSpeakingMsgId(null);
    setConversationId(`conv_${Date.now()}`);
    setMessages([
      {
        id: "initial-greeting",
        sender: "assistant",
        text: initialGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }

  return (
    <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-6 h-[calc(100vh-140px)]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ name: "home" })}>
            <ArrowLeft className="size-5" />
          </Button>
          <span className="size-10 rounded-xl bg-teal-700 text-white grid place-items-center shadow-xs">
            <Sparkles className="size-5 text-amber-300" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Godavari AI Assistant</h1>
            <p className="text-xs text-muted-foreground">
              {lang === "te"
                ? "గోదావరి పుష్కరాలు 2027 అధికారిక డిజిటల్ గైడ్"
                : "Official AI Guide · Godavari Pushkaralu 2027"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLang(lang === "en" ? "te" : "en")}
            className="text-xs font-semibold"
          >
            {lang === "en" ? "తెలుగు" : "English"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleResetChat} className="text-xs">
            <RotateCcw className="size-3.5 mr-1.5" /> New Chat
          </Button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 nice-scroll">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.sender === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div
              className={`size-8 rounded-full grid place-items-center shrink-0 ${
                msg.sender === "user"
                  ? "bg-teal-700 text-white"
                  : "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
              }`}
            >
              {msg.sender === "user" ? <UserIcon className="size-4" /> : <Bot className="size-4" />}
            </div>

            <div className={`space-y-1 max-w-[80%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed shadow-xs ${
                  msg.sender === "user"
                    ? "bg-teal-700 text-white rounded-tr-none"
                    : "bg-card border text-card-foreground rounded-tl-none"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Emergency banner */}
                {msg.emergencyNotice?.isEmergency && (
                  <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-xs">
                      <ShieldAlert className="size-4 shrink-0" />
                      <span>OFFICIAL EMERGENCY HELPLINES</span>
                    </div>
                    <p className="text-xs leading-normal">{msg.emergencyNotice.notice}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {msg.emergencyNotice.helplines.map((h) => (
                        <a
                          key={h.number}
                          href={`tel:${h.number}`}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
                        >
                          <PhoneCall className="size-3" /> {h.label}: {h.number}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Listing Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Verified Active Listings:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {msg.citations.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-xl border bg-background hover:border-teal-500/50 transition-colors flex items-start justify-between gap-2"
                        >
                          <div className="space-y-1 min-w-0">
                            <p className="font-semibold text-xs text-foreground truncate">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{c.address}</p>
                            {c.isTemporarilyClosed && (
                              <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                                CLOSED
                              </Badge>
                            )}
                            {c.crowdStatus && !c.isTemporarilyClosed && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-teal-500 text-teal-600">
                                Crowd: {c.crowdStatus}
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 shrink-0 border-teal-600 text-teal-700 hover:bg-teal-50"
                            onClick={() => navigate({ name: "listing", id: c.id })}
                          >
                            View <ChevronRight className="size-3 ml-0.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.suggestedActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleActionClick(action)}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/20 transition-colors"
                      >
                        {lang === "te" && action.labelTe ? action.labelTe : action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
                <span>{msg.timestamp}</span>
                {msg.sender === "assistant" && (
                  <>
                    <button
                      onClick={() => handleReadAloud(msg.id, msg.text)}
                      className={`p-1 rounded hover:bg-muted ${speakingMsgId === msg.id ? "text-teal-600 font-bold" : ""}`}
                      title="Read aloud"
                    >
                      {speakingMsgId === msg.id ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                    </button>
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="p-1 rounded hover:bg-muted"
                      title="Copy"
                    >
                      {copiedId === msg.id ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    </button>
                    <button
                      onClick={() => {
                        setFeedbackGiven((prev) => ({ ...prev, [msg.id]: "up" }));
                        toast({ title: "Feedback", description: "Thank you for your feedback!" });
                      }}
                      className={`p-1 rounded hover:bg-muted ${feedbackGiven[msg.id] === "up" ? "text-emerald-600" : ""}`}
                    >
                      <ThumbsUp className="size-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setFeedbackGiven((prev) => ({ ...prev, [msg.id]: "down" }));
                        toast({ title: "Feedback", description: "We appreciate your feedback." });
                      }}
                      className={`p-1 rounded hover:bg-muted ${feedbackGiven[msg.id] === "down" ? "text-red-500" : ""}`}
                    >
                      <ThumbsDown className="size-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-teal-100 text-teal-800 grid place-items-center">
              <Bot className="size-4" />
            </div>
            <div className="bg-card border rounded-2xl rounded-tl-none px-4 py-3 shadow-xs">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-teal-600 animate-bounce" />
                <span className="size-2 rounded-full bg-teal-600 animate-bounce [animation-delay:0.2s]" />
                <span className="size-2 rounded-full bg-teal-600 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Chips */}
      <div className="py-2 flex gap-2 overflow-x-auto nice-scroll shrink-0">
        {quickQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs rounded-full border border-border bg-card hover:bg-accent text-muted-foreground whitespace-nowrap"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="pt-2 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 p-2 rounded-2xl border bg-card shadow-sm"
        >
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`p-2.5 rounded-xl border transition-colors ${
              isListening ? "bg-red-500 text-white animate-pulse" : "hover:bg-muted text-muted-foreground"
            }`}
            title="Speech input"
          >
            {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>

          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              lang === "te"
                ? "గోదావరి పుష్కరాలు గురించి అడగండి..."
                : "Ask anything about ghats, hotels, free food, purohits..."
            }
            className="flex-1 border-0 shadow-none focus-visible:ring-0 text-sm"
            disabled={isLoading}
          />

          <Button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl px-4"
          >
            <Send className="size-4 mr-1.5" /> Send
          </Button>
        </form>
      </div>
    </div>
  );
}
