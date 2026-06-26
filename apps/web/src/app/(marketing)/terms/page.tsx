export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
        <p className="mb-8 text-zinc-400">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By downloading, installing, or using the Proenpt extension and web services, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Service Usage and Updates</h2>
            <p>
              Proenpt provides AI prompt optimization services. We are constantly improving our tools, which means <strong>there may be changes or updates that arrive to the extension</strong> at any time. We reserve the right to modify, suspend, or discontinue any part of the service without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Disclaimer of Liability</h2>
            <p className="font-semibold text-white bg-white/5 p-4 rounded-lg border border-white/10 mt-4">
              IMPORTANT: Any inconvenience, data loss, prompt misconfiguration, or issues caused by your side or your misuse of the tool is solely your responsibility, and not the responsibility of the developer (Proenpt).
            </p>
            <p className="mt-4">
              The service is provided "as is" without any warranties, express or implied. We do not guarantee that the AI-generated optimizations will be perfectly accurate, error-free, or suitable for your specific use cases. You are responsible for reviewing and verifying the outputs before using them in critical environments.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Account and Security</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and API limits. Sharing your account or attempting to bypass rate limits may result in immediate suspension of your access.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Contact</h2>
            <p>
              For any billing inquiries, support, or questions regarding these terms, please contact us at aroyog321@gmail.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
