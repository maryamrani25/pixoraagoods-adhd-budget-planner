// Applies the saved theme before the app loads, to avoid a flash of the wrong colours.
try {
  var t = JSON.parse(localStorage.getItem('pg-theme') || '"system"');
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
