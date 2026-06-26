export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
        <p className="mb-8 text-zinc-400">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. What Data We Collect</h2>
            <p>
              We believe in complete transparency. Proenpt is designed to respect your privacy while providing powerful AI optimizations. Here is the exact truth about what we collect:
            </p>
            <ul className="list-disc pl-6 mt-4 space-y-2">
              <li><strong>Account Information:</strong> When you sign up, we securely store your email address and authentication data via our database provider (Supabase) to manage your account and subscription limits.</li>
              <li><strong>Active Prompt Data:</strong> We <strong>ONLY</strong> read the text inside your input box at the exact moment you explicitly click the "Optimize" button. This text is sent to our servers to be optimized and is saved to your personal history log so you can access it later.</li>
              <li><strong>Context Memory:</strong> The custom instructions, tone, and audience settings you provide in your dashboard are stored securely. This data is injected into your prompts at runtime to personalize your outputs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. What We DO NOT Collect</h2>
            <p>
              The Proenpt extension operates strictly as an overlay. It does <strong>not</strong> read, monitor, scrape, or store your chat history with ChatGPT, Claude, Gemini, or any other AI model. It only accesses the text you actively submit for optimization.
            </p>
            <p className="mt-4">
              Furthermore, we do <strong>not</strong> use your prompt data or Context Memory to train our own AI models.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Future Updates to the Extension</h2>
            <p>
              Please note that as we continue to improve Proenpt, there may be changes or updates that arrive to the extension. We will always strive to communicate significant changes to our data collection practices if they evolve, but continued use of the extension constitutes acceptance of those updates.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Your Data Rights</h2>
            <p>
              You own your data. If you wish to delete your account, your prompt history, and your context memory, you may contact us at aroyog321@gmail.com and we will wipe your data from our servers.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
