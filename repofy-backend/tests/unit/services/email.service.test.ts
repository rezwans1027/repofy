import { describe, it, expect } from "vitest";
import { escapeHtml } from "../../../src/services/email.service";

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("a < b")).toBe("a &lt; b");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('a "b" c')).toBe("a &quot;b&quot; c");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("a 'b' c")).toBe("a &#39;b&#39; c");
  });

  it("escapes all five characters together", () => {
    expect(escapeHtml(`<div class="x" data-name='y'>&</div>`)).toBe(
      "&lt;div class=&quot;x&quot; data-name=&#39;y&#39;&gt;&amp;&lt;/div&gt;",
    );
  });

  it("neutralises script injection", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
    );
  });

  it("neutralises attribute injection via double quote", () => {
    expect(escapeHtml('" onmouseover="alert(1)"')).toBe(
      "&quot; onmouseover=&quot;alert(1)&quot;",
    );
  });

  it("neutralises attribute injection via single quote", () => {
    expect(escapeHtml("' onfocus='alert(1)'")).toBe(
      "&#39; onfocus=&#39;alert(1)&#39;",
    );
  });

  it("neutralises nested/combined injection patterns", () => {
    const input = `<img src="x" onerror="alert('<script>')">`;
    expect(escapeHtml(input)).toBe(
      "&lt;img src=&quot;x&quot; onerror=&quot;alert(&#39;&lt;script&gt;&#39;)&quot;&gt;",
    );
  });

  it("neutralises event handler injection in tag", () => {
    expect(escapeHtml('<a href="#" onclick="steal()">')).toBe(
      "&lt;a href=&quot;#&quot; onclick=&quot;steal()&quot;&gt;",
    );
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("passes through string with no special characters", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("passes through unicode characters without modification", () => {
    expect(escapeHtml("Caf\u00e9 \u2603 \u2764\ufe0f")).toBe("Caf\u00e9 \u2603 \u2764\ufe0f");
  });

  it("handles string that is only special characters", () => {
    expect(escapeHtml("<>&\"'")).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("handles repeated special characters", () => {
    expect(escapeHtml("<<<>>>")).toBe("&lt;&lt;&lt;&gt;&gt;&gt;");
  });

  it("handles ampersand at the start to avoid double-escaping confusion", () => {
    // Verifies & is escaped first, so &lt; in input becomes &amp;lt;
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("handles multiline strings", () => {
    const input = "line1 <b>\nline2 & 'stuff'";
    expect(escapeHtml(input)).toBe("line1 &lt;b&gt;\nline2 &amp; &#39;stuff&#39;");
  });
});
