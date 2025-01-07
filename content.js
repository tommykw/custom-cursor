const circle = document.createElement("div");
circle.id = "custom-cursor";
document.body.appendChild(circle);

document.addEventListener("mousemove", (e) => {
  circle.style.left = e.clientX + "px";
  circle.style.top = e.clientY + "px";
});

document.addEventListener("click", () => {
  circle.animate(
    [
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      { transform: "translate(-50%, -50%) scale(1.2)", opacity: 0.8 },
      { transform: "translate(-50%, -50%) scale(1)" , opacity: 1 },
    ],
    { duration: 200, easing: "ease-out" }
  );
});
