import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateTimingStatus,
  formatTime12h,
  getIstParts,
  type ListingScheduleData,
} from "../src/lib/timing";

describe("Timing & Operating Hours Calculation Engine (Asia/Kolkata)", () => {
  it("returns HOURS_NOT_AVAILABLE when schedule is null or empty", () => {
    const res1 = calculateTimingStatus(null);
    assert.equal(res1.code, "HOURS_NOT_AVAILABLE");
    assert.equal(res1.label, "Hours not available");
    assert.equal(res1.isOpen, false);

    const res2 = calculateTimingStatus({});
    assert.equal(res2.code, "HOURS_NOT_AVAILABLE");
  });

  it("handles 24 hours operating schedule correctly", () => {
    const schedule: ListingScheduleData = {
      open24Hours: true,
    };
    const res = calculateTimingStatus(schedule);
    assert.equal(res.code, "OPEN_24_HOURS");
    assert.equal(res.isOpen, true);
    assert.equal(res.label, "Open 24 hours");
  });

  it("handles temporary closures with announcements and reasons", () => {
    const schedule: ListingScheduleData = {
      openingTime: "06:00",
      closingTime: "21:00",
      isTemporarilyClosed: true,
      temporaryClosureReason: "High flood water alert & safety barrier repair",
      temporaryClosureUntil: new Date("2026-10-25T18:30:00Z"),
    };
    const res = calculateTimingStatus(schedule, new Date("2026-10-17T06:00:00Z"));
    assert.equal(res.code, "TEMPORARILY_CLOSED");
    assert.equal(res.isOpen, false);
    assert.equal(res.isTemporarilyClosed, true);
    assert.match(res.detail, /Temporarily closed/);
    assert.match(res.detail, /High flood water alert/);
  });

  it("handles standard single-interval opening and closing times", () => {
    // Reference date: 2026-10-17 10:00:00 IST -> 2026-10-17 04:30:00 UTC
    const dateAt10AmIst = new Date("2026-10-17T04:30:00.000Z");
    const schedule: ListingScheduleData = {
      openingTime: "07:00",
      closingTime: "22:00",
      operatingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
    };
    const res = calculateTimingStatus(schedule, dateAt10AmIst);
    assert.equal(res.code, "OPEN_NOW");
    assert.equal(res.isOpen, true);
    assert.match(res.detail, /Closes at 10:00 PM/);

    // Before opening: 05:00 AM IST -> 2026-10-16 23:30:00 UTC
    const dateAt5AmIst = new Date("2026-10-16T23:30:00.000Z");
    const resEarly = calculateTimingStatus(schedule, dateAt5AmIst);
    assert.equal(resEarly.code, "CLOSED_NOW");
    assert.equal(resEarly.isOpen, false);
    assert.match(resEarly.detail, /Opens at 7:00 AM/);
  });

  it("handles multi-interval break times (e.g., temples or afternoon restaurant closure)", () => {
    // Schedule: 06:00 - 12:00 and 16:00 - 21:00
    const schedule: ListingScheduleData = {
      openingTime: "06:00",
      closingTime: "21:00",
      breakStart: "12:00",
      breakEnd: "16:00",
    };

    // At 14:00 (2:00 PM) IST -> during break
    // 14:00 IST = 08:30 UTC
    const duringBreak = new Date("2026-10-17T08:30:00.000Z");
    const resBreak = calculateTimingStatus(schedule, duringBreak);
    assert.equal(resBreak.code, "CLOSED_NOW");
    assert.equal(resBreak.isOpen, false);
    assert.match(resBreak.detail, /Opens at 4:00 PM/);

    // At 18:00 (6:00 PM) IST -> evening session open
    // 18:00 IST = 12:30 UTC
    const eveningSession = new Date("2026-10-17T12:30:00.000Z");
    const resEvening = calculateTimingStatus(schedule, eveningSession);
    assert.equal(resEvening.code, "OPEN_NOW");
    assert.equal(resEvening.isOpen, true);
    assert.match(resEvening.detail, /Closes at 9:00 PM/);
  });

  it("handles overnight hours extending into early morning next day", () => {
    // Restaurant / Lounge open 19:00 to 02:00 (overnight)
    const schedule: ListingScheduleData = {
      intervals: [{ open: "19:00", close: "02:00" }],
    };

    // At 23:00 IST (11:00 PM) -> open
    // 23:00 IST = 17:30 UTC
    const night = new Date("2026-10-17T17:30:00.000Z");
    const resNight = calculateTimingStatus(schedule, night);
    assert.equal(resNight.code, "OPEN_NOW");
    assert.equal(resNight.isOpen, true);
    assert.match(resNight.detail, /Closes at 2:00 AM/);

    // At 01:15 AM IST next day (2026-10-18) -> still open from yesterday's session!
    // 01:15 IST = 2026-10-17 19:45:00 UTC
    const earlyMorning = new Date("2026-10-17T19:45:00.000Z");
    const resEarly = calculateTimingStatus(schedule, earlyMorning);
    assert.equal(resEarly.code, "OPEN_NOW");
    assert.equal(resEarly.isOpen, true);
    assert.match(resEarly.detail, /Closes at 2:00 AM/);

    // At 03:00 AM IST next day -> closed now
    // 03:00 IST = 2026-10-17 21:30:00 UTC
    const afterClose = new Date("2026-10-17T21:30:00.000Z");
    const resClosed = calculateTimingStatus(schedule, afterClose);
    assert.equal(resClosed.code, "CLOSED_NOW");
    assert.equal(resClosed.isOpen, false);
    assert.match(resClosed.detail, /Opens at 7:00 PM/);
  });

  it("handles special festival or holiday dates overriding normal schedule", () => {
    const schedule: ListingScheduleData = {
      openingTime: "09:00",
      closingTime: "18:00",
      specialHours: [
        {
          date: "2026-10-17",
          isClosed: false,
          open: "04:00",
          close: "23:30",
          note: "Godavari Mahapuja Special",
        },
      ],
    };

    // At 05:00 AM IST on 2026-10-17 (normally closed, but open for Mahapuja)
    // 05:00 IST = 2026-10-16 23:30:00 UTC
    const specialDate = new Date("2026-10-16T23:30:00.000Z");
    const res = calculateTimingStatus(schedule, specialDate);
    assert.equal(res.code, "OPEN_NOW");
    assert.equal(res.isOpen, true);
    assert.match(res.detail, /Closes at 11:30 PM/);
  });

  it("handles closed days of the week", () => {
    // 2026-10-18 is Sunday in IST
    const sundayDate = new Date("2026-10-18T05:00:00.000Z"); // 10:30 AM IST Sunday
    const schedule: ListingScheduleData = {
      openingTime: "09:00",
      closingTime: "18:00",
      closedDays: ["SUNDAY"],
    };
    const res = calculateTimingStatus(schedule, sundayDate);
    assert.equal(res.code, "CLOSED_NOW");
    assert.equal(res.isOpen, false);
    assert.match(res.detail, /Closed today/);
  });
});
