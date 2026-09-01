import './App.css'

const capabilities = [
  'Read exact book context',
  'Create worked explanations',
  'Build visual study labs',
  'Annotate and reshape the text',
]

function App() {
  return (
    <main>
      <header className="masthead">
        <span className="wordmark">Study Reader</span>
        <span className="status">WebMCP proof of concept</span>
      </header>

      <section className="hero">
        <p className="eyebrow">A book is more than a document</p>
        <h1>Let the page become the lesson.</h1>
        <p className="lede">
          A local-first ebook reader with semantic tools that let an AI tutor
          explain, illustrate, annotate, and transform what you are studying.
        </p>

        <button type="button" disabled>
          Open a book <span>Coming next</span>
        </button>
      </section>

      <section className="capabilities" aria-label="Planned capabilities">
        {capabilities.map((capability, index) => (
          <article key={capability}>
            <span>0{index + 1}</span>
            <p>{capability}</p>
          </article>
        ))}
      </section>

      <footer>
        <p>Working title · 1 September 2026</p>
        <p>The reader comes first. WebMCP opens the rest.</p>
      </footer>
    </main>
  )
}

export default App

