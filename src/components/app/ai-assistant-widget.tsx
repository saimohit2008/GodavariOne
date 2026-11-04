"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  X,
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
  Maximize2,
  Minimize2,
  AlertTriangle,
  PhoneCall,
  MapPin,
  CalendarCheck,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
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

export function AiAssistantWidget() {
  const { lang, setLang, navigate, openBookingAuthModal, user } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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
      ? "నమస్కారం! గోదావరి వన్ డిజిటల్ అసిస్టెంట్‌కి స్వాగతం. గోదావరి పుష్కరాలు 2027 ఘాట్‌లు, ఉచిత వసతి, అన్నదానం, హోటళ్లు, మరియు పురోహితుల సమాచారం కోసం నేను మీకు ఎలా సహాయపడగలను?"
      : "Namaskaram! Welcome to Godavari One. I am your intelligent guide for Godavari Pushkaralu 2027. How can I assist you today with ghats, free stay, Annadanam, hotels, or purohits?";

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-greeting",
      sender: "assistant",
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  // Update greeting text if user toggles language
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === "initial-greeting") {
      setMessages([
        {
          id: "initial-greeting",
          sender: "assistant",
          text: initialGreeting,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [lang]);

  // Scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // Stop speaking when widget closes
  useEffect(() => {
    if (!isOpen) {
      stopSpeaking();
      setSpeakingMsgId(null);
    }
  }, [isOpen]);

  // Suggested questions
  const quickQuestions =
    lang === "te"
      ? [
          "రాజమండ్రిలో ఉచిత సత్రాలు ఎక్కడ ఉన్నాయి?",
          "ప్రస్తుతం ఏ ఘాట్లలో రద్దీ తక్కువగా ఉంది?",
          "పిండ ప్రదానం కోసం పురోహితుడిని ఎలా బుక్ చేసుకోవాలి?",
          "అత్యవసర ఆసుపత్రులు మరియు హెల్ప్‌లైన్లు ఏమిటి?",
        ]
      : [
          "Which ghats are free right now?",
          "Where can I find free accommodation?",
          "How do I book a certified Purohit?",
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

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data: AIChatResponse = await res.json();

      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        sender: "assistant",
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        citations: data.citations,
        suggestedActions: data.suggestedActions,
        emergencyNotice: data.emergencyNotice,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "assistant",
          text:
            lang === "te"
              ? "క్షమించండి, మీ అభ్యర్థనను ప్రాసెస్ చేయడంలో సాంకేతిక సమస్య ఏర్పడింది. దయచేసి డైరెక్టరీ విభాగాల ద్వారా శోధించండి."
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
        description: "Your browser does not support Web Speech Recognition. Please type your message.",
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
      onResult: (res) => {
        setInputMessage(res.transcript);
      },
      onError: (err) => {
        setIsListening(false);
        toast({ title: "Voice Input", description: err, variant: "destructive" });
      },
      onEnd: () => {
        setIsListening(false);
      },
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
    const success = speakText(text, lang, () => {
      setSpeakingMsgId(null);
    });

    if (!success) {
      setSpeakingMsgId(null);
      toast({
        title: "Speech Output",
        description: "Text-to-speech is not supported on this browser.",
      });
    }
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
      setIsOpen(false);
    } else if (action.type === "VIEW_LISTING") {
      navigate({ name: "listing", id: action.payload.listingId });
      setIsOpen(false);
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
      setIsOpen(false);
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
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-teal-700 via-teal-800 to-sky-900 text-white shadow-2xl hover:shadow-teal-900/50 hover:scale-105 transition-all duration-200 border border-teal-500/30 group"
          aria-label="Open Godavari AI Assistant"
        >
          <span className="size-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <Sparkles className="size-4 text-amber-300" />
          </span>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold leading-tight tracking-wide">Godavari AI</p>
            <p className="text-[10px] text-teal-200 leading-tight">
              {lang === "te" ? "డిజిటల్ గైడ్" : "Digital Guide"}
            </p>
          </div>
        </button>
      )}

      {/* Expandable Chat Drawer Window */}
      {isOpen && (
        <div
          className={`fixed z-50 bg-background border border-border shadow-2xl flex flex-col transition-all duration-300 ${
            isExpanded
              ? "inset-4 sm:inset-10 rounded-2xl max-w-4xl mx-auto"
              : "bottom-4 right-4 sm:bottom-6 sm:right-6 w-[95vw] sm:w-[440px] h-[640px] max-h-[88vh] rounded-2xl"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-800 to-sky-900 text-white rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="size-8 rounded-full bg-white/20 grid place-items-center">
                <Sparkles className="size-4 text-amber-300" />
              </span>
              <div>
                <h3 className="font-semibold text-sm leading-tight">Godavari AI</h3>
                <p className="text-[11px] text-teal-200 leading-tight">
                  {lang === "te" ? "మీ అధికారిక పుష్కర గైడ్" : "Your Intelligent Godavari Guide"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Language switcher */}
              <button
                onClick={() => setLang(lang === "en" ? "te" : "en")}
                className="px-2 py-1 text-[11px] font-medium rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                title="Toggle English / Telugu"
              >
                {lang === "en" ? "తెలుగు" : "English"}
              </button>

              {/* Reset chat */}
              <button
                onClick={handleResetChat}
                className="p-1.5 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title="New Chat"
              >
                <RotateCcw className="size-4" />
              </button>

              {/* Expand / Minimize */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:inline-flex p-1.5 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title={isExpanded ? "Minimize" : "Expand"}
              >
                {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>

              {/* Close */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 nice-scroll bg-muted/20">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs ${
                    msg.sender === "user"
                      ? "bg-teal-700 text-white rounded-br-none"
                      : "bg-card border text-card-foreground rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Emergency Warning Notice */}
                  {msg.emergencyNotice?.isEmergency && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-xs">
                        <ShieldAlert className="size-4 shrink-0" />
                        <span>EMERGENCY HELPLINES</span>
                      </div>
                      <p className="text-xs leading-normal">{msg.emergencyNotice.notice}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {msg.emergencyNotice.helplines.map((h) => (
                          <a
                            key={h.number}
                            href={`tel:${h.number}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
                          >
                            <PhoneCall className="size-3" /> {h.label}: {h.number}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grounded Listing Cards */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Verified Listings Cited:
                      </p>
                      <div className="space-y-2">
                        {msg.citations.map((c) => (
                          <div
                            key={c.id}
                            className="p-2.5 rounded-lg border bg-background hover:border-teal-500/50 transition-colors flex items-start justify-between gap-2"
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
                              onClick={() => {
                                navigate({ name: "listing", id: c.id });
                                setIsOpen(false);
                              }}
                            >
                              View <ChevronRight className="size-3 ml-0.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interactive Suggested Action Buttons */}
                  {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {msg.suggestedActions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleActionClick(action)}
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/20 transition-colors flex items-center gap-1"
                        >
                          {lang === "te" && action.labelTe ? action.labelTe : action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Message Footnotes & Controls */}
                <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-muted-foreground">
                  <span>{msg.timestamp}</span>

                  {msg.sender === "assistant" && (
                    <>
                      {/* Read Aloud Button */}
                      <button
                        onClick={() => handleReadAloud(msg.id, msg.text)}
                        className={`p-1 rounded hover:bg-muted transition-colors ${
                          speakingMsgId === msg.id ? "text-teal-600 font-bold" : ""
                        }`}
                        title="Read aloud"
                      >
                        {speakingMsgId === msg.id ? (
                          <VolumeX className="size-3.5" />
                        ) : (
                          <Volume2 className="size-3.5" />
                        )}
                      </button>

                      {/* Copy Button */}
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedId === msg.id ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                      </button>

                      {/* Feedback Thumbs */}
                      <button
                        onClick={() => {
                          setFeedbackGiven((prev) => ({ ...prev, [msg.id]: "up" }));
                          toast({ title: "Feedback", description: "Thank you for your feedback!" });
                        }}
                        className={`p-1 rounded hover:bg-muted transition-colors ${
                          feedbackGiven[msg.id] === "up" ? "text-emerald-600" : ""
                        }`}
                        title="Helpful"
                      >
                        <ThumbsUp className="size-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setFeedbackGiven((prev) => ({ ...prev, [msg.id]: "down" }));
                          toast({ title: "Feedback", description: "We will improve our recommendations." });
                        }}
                        className={`p-1 rounded hover:bg-muted transition-colors ${
                          feedbackGiven[msg.id] === "down" ? "text-red-500" : ""
                        }`}
                        title="Not helpful"
                      >
                        <ThumbsDown className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="bg-card border rounded-2xl rounded-bl-none px-4 py-3 shadow-xs">
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

          {/* Suggested Quick Question Chips */}
          <div className="px-3 py-2 border-t border-border/50 bg-background/80 overflow-x-auto whitespace-nowrap nice-scroll flex gap-1.5 shrink-0">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={isLoading}
                className="px-2.5 py-1 text-xs rounded-full border border-border bg-card hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors shrink-0"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t bg-card rounded-b-2xl shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              {/* Mic Speech-to-Text Button */}
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`p-2 rounded-full border transition-colors ${
                  isListening
                    ? "bg-red-500 text-white border-red-600 animate-pulse"
                    : "hover:bg-muted text-muted-foreground"
                }`}
                title={isListening ? "Listening... Click to stop" : "Speak your question"}
              >
                {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </button>

              {/* Text Input */}
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  lang === "te"
                    ? "గోదావరి పుష్కరాల గురించి అడగండి..."
                    : "Ask about ghats, hotels, free food, purohits..."
                }
                className="flex-1 text-sm rounded-full h-10 px-4 focus-visible:ring-teal-600"
                disabled={isLoading}
              />

              {/* Send Button */}
              <Button
                type="submit"
                size="icon"
                disabled={!inputMessage.trim() || isLoading}
                className="rounded-full size-10 bg-teal-700 hover:bg-teal-800 text-white shrink-0"
              >
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
