// Apply before the app/CSS loads to avoid a light flash on a dark device.
(() => {
  let preference = "system";
  try {
    const saved = localStorage.getItem("onebody.theme");
    if (["light", "dark", "system"].includes(saved)) preference = saved;
  } catch {
    /* Storage can be unavailable in private/restricted browsers. */
  }
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#100d1d" : "#3e285b");
})();
