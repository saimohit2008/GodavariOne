"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Clock, Calendar, AlertTriangle, ShieldCheck, Plus, Trash2 } from "lucide-react";
import { DAYS_OF_WEEK, type DayOfWeek } from "@/lib/timing";

export function TimingManagerDialog({
  listingId,
  listingName,
  category,
  currentSchedule,
  onClose,
  onSaved,
}: {
  listingId: string;
  listingName: string;
  category: string;
  currentSchedule?: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [open24Hours, setOpen24Hours] = useState<boolean>(!!currentSchedule?.open24Hours);
  const [isTemporarilyClosed, setIsTemporarilyClosed] = useState<boolean>(!!currentSchedule?.isTemporarilyClosed);
  const [temporaryClosureReason, setTemporaryClosureReason] = useState<string>(
    currentSchedule?.temporaryClosureReason || ""
  );
  const [temporaryClosureUntil, setTemporaryClosureUntil] = useState<string>(
    currentSchedule?.temporaryClosureUntil ? currentSchedule.temporaryClosureUntil.slice(0, 10) : ""
  );

  const [openingTime, setOpeningTime] = useState<string>(currentSchedule?.openingTime || "06:00");
  const [closingTime, setClosingTime] = useState<string>(currentSchedule?.closingTime || "21:00");

  const [hasBreak, setHasBreak] = useState<boolean>(!!(currentSchedule?.breakStart && currentSchedule?.breakEnd));
  const [breakStart, setBreakStart] = useState<string>(currentSchedule?.breakStart || "13:00");
  const [breakEnd, setBreakEnd] = useState<string>(currentSchedule?.breakEnd || "16:00");

  const initialDays: string[] = Array.isArray(currentSchedule?.operatingDays)
    ? currentSchedule.operatingDays
    : [...DAYS_OF_WEEK];
  const [operatingDays, setOperatingDays] = useState<string[]>(initialDays);

  const initialClosedDays: string[] = Array.isArray(currentSchedule?.closedDays)
    ? currentSchedule.closedDays
    : [];
  const [closedDays, setClosedDays] = useState<string[]>(initialClosedDays);

  // Special holiday / event hours
  const initialSpecial = Array.isArray(currentSchedule?.specialHours) ? currentSchedule.specialHours : [];
  const [specialHours, setSpecialHours] = useState<Array<{ date: string; isClosed: boolean; open?: string; close?: string; note?: string }>>(
    initialSpecial
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function toggleDay(day: string) {
    if (operatingDays.includes(day)) {
      setOperatingDays(operatingDays.filter((d) => d !== day));
      if (!closedDays.includes(day)) {
        setClosedDays([...closedDays, day]);
      }
    } else {
      setOperatingDays([...operatingDays, day]);
      setClosedDays(closedDays.filter((d) => d !== day));
    }
  }

  function addSpecialDate() {
    const today = new Date().toISOString().slice(0, 10);
    setSpecialHours([
      ...specialHours,
      { date: today, isClosed: false, open: "04:00", close: "23:00", note: "Pushkaram Mahapuja" },
    ]);
  }

  function removeSpecialDate(index: number) {
    setSpecialHours(specialHours.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setErrorMsg("");
    setSubmitting(true);
    try {
      const payload: any = {
        open24Hours,
        isTemporarilyClosed,
        temporaryClosureReason: temporaryClosureReason.trim() || null,
        temporaryClosureUntil: temporaryClosureUntil || null,
        timezone: "Asia/Kolkata",
        operatingDays,
        closedDays,
        specialHours: specialHours.filter((s) => s.date),
      };

      if (!open24Hours) {
        payload.openingTime = openingTime || null;
        payload.closingTime = closingTime || null;
        if (hasBreak && breakStart && breakEnd) {
          payload.breakStart = breakStart;
          payload.breakEnd = breakEnd;
        } else {
          payload.breakStart = null;
          payload.breakEnd = null;
        }
      }

      await api.put(`/listings/${listingId}/timing`, payload);
      toast({
        title: "Operating hours updated",
        description: `Schedule and timings for ${listingName} saved successfully.`,
      });
      onSaved();
    } catch (err: any) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to update operating hours");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-teal-600 mb-0.5">
            <Clock className="size-5" />
            <DialogTitle>Operating Hours & Timings</DialogTitle>
          </div>
          <DialogDescription>
            Maintain operating hours, daily breaks, temporary closures, and holiday schedules for{" "}
            <strong>{listingName}</strong> ({category}).
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4 py-2 text-xs">
          {/* Temporary Closure Announcement */}
          <div className="p-3.5 border rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-xs text-amber-900 dark:text-amber-300">
                  Temporary Closure Status
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                  Mark listing as temporarily closed with an official announcement.
                </p>
              </div>
              <Switch checked={isTemporarilyClosed} onCheckedChange={setIsTemporarilyClosed} />
            </div>

            {isTemporarilyClosed && (
              <div className="space-y-2.5 pt-2 border-t border-amber-200">
                <div>
                  <Label className="text-[11px] text-amber-900 dark:text-amber-200">
                    Official Closure Reason / Announcement *
                  </Label>
                  <Textarea
                    value={temporaryClosureReason}
                    onChange={(e) => setTemporaryClosureReason(e.target.value)}
                    placeholder="e.g. Annual Ghat desilting & water safety inspection..."
                    rows={2}
                    className="mt-1 text-xs bg-background"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-amber-900 dark:text-amber-200">
                    Reopening Effective Date (Optional)
                  </Label>
                  <Input
                    type="date"
                    value={temporaryClosureUntil}
                    onChange={(e) => setTemporaryClosureUntil(e.target.value)}
                    className="mt-1 h-8 text-xs bg-background"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 24 Hours Toggle */}
          <div className="flex items-center justify-between p-3 border rounded-xl bg-muted/40">
            <div>
              <p className="font-semibold text-xs">Open 24 Hours</p>
              <p className="text-[11px] text-muted-foreground">
                Applicable to hospitals, 24/7 ghats, emergency centers, and travel desks.
              </p>
            </div>
            <Switch checked={open24Hours} onCheckedChange={setOpen24Hours} />
          </div>

          {/* Standard Opening & Closing Hours */}
          {!open24Hours && (
            <div className="space-y-3 p-3.5 border rounded-xl">
              <p className="font-semibold text-xs">Standard Daily Hours (IST)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px]">Opening Time (24h format)</Label>
                  <Input
                    type="time"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Closing Time (24h format)</Label>
                  <Input
                    type="time"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                * Overnight hours supported (e.g. Opening at 19:00 and closing at 02:00 AM next day).
              </p>

              {/* Afternoon Break / Sessions */}
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] cursor-pointer">
                    Mid-Day Break / Closure (e.g. Afternoon break)
                  </Label>
                  <Switch checked={hasBreak} onCheckedChange={setHasBreak} />
                </div>
                {hasBreak && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Break Starts</Label>
                      <Input
                        type="time"
                        value={breakStart}
                        onChange={(e) => setBreakStart(e.target.value)}
                        className="mt-1 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Break Ends (Reopens)</Label>
                      <Input
                        type="time"
                        value={breakEnd}
                        onChange={(e) => setBreakEnd(e.target.value)}
                        className="mt-1 h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Operating Days of the Week */}
          <div className="space-y-2 p-3.5 border rounded-xl">
            <p className="font-semibold text-xs">Operating Days of the Week</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {DAYS_OF_WEEK.map((d) => {
                const isOpen = operatingDays.includes(d);
                return (
                  <label
                    key={d}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                      isOpen ? "bg-teal-50/50 border-teal-300 text-teal-900 font-medium dark:bg-teal-950/30" : "bg-muted/40 opacity-60"
                    }`}
                  >
                    <Checkbox checked={isOpen} onCheckedChange={() => toggleDay(d)} />
                    <span>{d.slice(0, 3)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Special Holiday / Event Schedules */}
          <div className="space-y-3 p-3.5 border rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-xs">Special Event / Festival Dates</p>
                <p className="text-[11px] text-muted-foreground">
                  Override standard timings for Pushkaram special days, holidays, or festivals.
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addSpecialDate}>
                <Plus className="size-3 mr-1" /> Add Date
              </Button>
            </div>

            <div className="space-y-2">
              {specialHours.map((sp, idx) => (
                <div key={idx} className="p-2.5 border rounded-lg bg-muted/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      type="date"
                      value={sp.date}
                      onChange={(e) => {
                        const copy = [...specialHours];
                        copy[idx].date = e.target.value;
                        setSpecialHours(copy);
                      }}
                      className="h-7 text-xs w-36"
                    />
                    <Input
                      placeholder="Event Note (e.g. Mahapuja)"
                      value={sp.note || ""}
                      onChange={(e) => {
                        const copy = [...specialHours];
                        copy[idx].note = e.target.value;
                        setSpecialHours(copy);
                      }}
                      className="h-7 text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => removeSpecialDate(idx)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <Checkbox
                        checked={sp.isClosed}
                        onCheckedChange={(c) => {
                          const copy = [...specialHours];
                          copy[idx].isClosed = !!c;
                          setSpecialHours(copy);
                        }}
                      />
                      <span>Fully Closed All Day</span>
                    </label>
                    {!sp.isClosed && (
                      <div className="flex items-center gap-1 text-[11px] ml-auto">
                        <Input
                          type="time"
                          value={sp.open || "04:00"}
                          onChange={(e) => {
                            const copy = [...specialHours];
                            copy[idx].open = e.target.value;
                            setSpecialHours(copy);
                          }}
                          className="h-6 w-24 text-[10px]"
                        />
                        <span>to</span>
                        <Input
                          type="time"
                          value={sp.close || "23:00"}
                          onChange={(e) => {
                            const copy = [...specialHours];
                            copy[idx].close = e.target.value;
                            setSpecialHours(copy);
                          }}
                          className="h-6 w-24 text-[10px]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground flex items-center justify-between px-1">
            <span>Timezone: <strong>India Standard Time (Asia/Kolkata, UTC+5:30)</strong></span>
            <span>Recorded in audit log</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting} className="bg-teal-600 hover:bg-teal-700 text-white">
            {submitting ? "Saving..." : "Save Operating Hours"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
