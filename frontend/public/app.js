// Animaciones al hacer scroll
const sections = document.querySelectorAll(".fade-in, .slide-in-right");

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add("visible");
  });
}, { threshold: 0.2 });

sections.forEach(sec => observer.observe(sec));
