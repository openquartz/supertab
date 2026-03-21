document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-btn');
  if (!closeBtn) return;

  closeBtn.addEventListener('click', () => {
    window.close();
  });
});
