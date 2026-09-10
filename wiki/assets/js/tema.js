/* Se carga en <head>, antes de pintar: evita el destello de tema. */
try {
  var t = localStorage.getItem('ici-tema');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
