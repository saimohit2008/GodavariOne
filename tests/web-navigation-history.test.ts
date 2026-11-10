import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { viewToUrl, urlToView, type View } from "../src/lib/store";

describe("Godavari One — Web Navigation & Browser History Synchronization", () => {
  test("1. Homepage maps to / and roundtrips", () => {
    const homeView: View = { name: "home" };
    const url = viewToUrl(homeView);
    assert.equal(url, "/");
    assert.equal(urlToView("/"), null);
    assert.deepEqual(urlToView("/?view=home"), { name: "home" });
  });

  test("2. Directory with category and search query serializes and deserializes", () => {
    const dirView: View = { name: "directory", category: "GHAT", q: "pushkar" };
    const url = viewToUrl(dirView);
    assert.equal(url, "/?view=directory&category=GHAT&q=pushkar");
    const parsed = urlToView(url);
    assert.deepEqual(parsed, dirView);
  });

  test("3. Directory with only category or only q", () => {
    const dirCat: View = { name: "directory", category: "HOTEL" };
    const urlCat = viewToUrl(dirCat);
    assert.equal(urlCat, "/?view=directory&category=HOTEL");
    assert.deepEqual(urlToView(urlCat), { name: "directory", category: "HOTEL", q: undefined });

    const dirQ: View = { name: "directory", q: "annadanam" };
    const urlQ = viewToUrl(dirQ);
    assert.equal(urlQ, "/?view=directory&q=annadanam");
    assert.deepEqual(urlToView(urlQ), { name: "directory", category: undefined, q: "annadanam" });
  });

  test("4. Listing detail view with id preserves listing ID", () => {
    const listingView: View = { name: "listing", id: "ghat-kotilingala-123" };
    const url = viewToUrl(listingView);
    assert.equal(url, "/?view=listing&id=ghat-kotilingala-123");
    assert.deepEqual(urlToView(url), listingView);
  });

  test("5. Listing form view with id and category", () => {
    const formView: View = { name: "listing-form", id: "lst-456", category: "RESTAURANT" };
    const url = viewToUrl(formView);
    assert.equal(url, "/?view=listing-form&id=lst-456&category=RESTAURANT");
    assert.deepEqual(urlToView(url), formView);
  });

  test("6. Admin view with tab preserves active tab", () => {
    const adminView: View = { name: "admin", tab: "settings" };
    const url = viewToUrl(adminView);
    assert.equal(url, "/?view=admin&tab=settings");
    assert.deepEqual(urlToView(url), adminView);
  });

  test("7. Ceremonies view with category and purohitId", () => {
    const ceremonyView: View = { name: "ceremonies", category: "PITRU", purohitId: "purohit-99" };
    const url = viewToUrl(ceremonyView);
    assert.equal(url, "/?view=ceremonies&category=PITRU&purohitId=purohit-99");
    assert.deepEqual(urlToView(url), ceremonyView);
  });

  test("8. Carousel detail view preserves carousel item ID", () => {
    const carView: View = { name: "carousel-detail", id: "carousel-banner-1" };
    const url = viewToUrl(carView);
    assert.equal(url, "/?view=carousel-detail&id=carousel-banner-1");
    assert.deepEqual(urlToView(url), carView);
  });

  test("9. NRI access view preserves ref query parameter", () => {
    const nriView: View = { name: "nri-access", ref: "NRI-2027-PKG" };
    const url = viewToUrl(nriView);
    assert.equal(url, "/?view=nri-access&ref=NRI-2027-PKG");
    assert.deepEqual(urlToView(url), nriView);
  });

  test("10. Standard named views roundtrip accurately", () => {
    const simpleViews: View[] = [
      { name: "login" },
      { name: "register" },
      { name: "admin-login" },
      { name: "bookings" },
      { name: "favorites" },
      { name: "notifications" },
      { name: "visitor-dashboard" },
      { name: "owner-dashboard" },
      { name: "ghat-reporter" },
      { name: "ghat-supervisor" },
      { name: "editor-dashboard" },
      { name: "reviewer-dashboard" },
      { name: "nri-service-manager" },
      { name: "purohit-dashboard" },
      { name: "ai-assistant" },
    ];

    for (const v of simpleViews) {
      const url = viewToUrl(v);
      assert.equal(url, `/?view=${v.name}`);
      const parsed = urlToView(url);
      assert.deepEqual(parsed, v, `Failed roundtrip for ${v.name}`);
    }
  });

  test("11. Direct category parameter without view= name maps to directory view", () => {
    const parsed = urlToView("?category=GHAT");
    assert.deepEqual(parsed, { name: "directory", category: "GHAT", q: undefined });
  });

  test("12. Malformed or invalid view query string safely returns null", () => {
    assert.equal(urlToView(""), null);
    assert.equal(urlToView("?"), null);
    assert.equal(urlToView("?foo=bar"), null);
    assert.equal(urlToView("?view=nonexistent_view_type"), null);
  });
});

