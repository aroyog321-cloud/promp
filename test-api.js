
(async () => {
  const res = await fetch('http://localhost:3000/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalPrompt: "test",
      optimizedPrompt: "test optimized"
    })
  });
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
})();
