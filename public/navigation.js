const menu = document.getElementById("sidebar");
const toggle = document.getElementById("menu-toggle");
const overlay = document.getElementById("menu-overlay");

function setMenu(open) {
  document.body.classList.toggle("nav-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  menu.inert = !open;
  if (open) menu.querySelector("[data-view]")?.focus();
  else toggle.focus();
}

menu.inert = true;
toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
overlay.addEventListener("click", () => setMenu(false));
menu.addEventListener("click", (event) => {
  if (event.target.closest("[data-view]")) setMenu(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") setMenu(false);
});
