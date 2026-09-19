import { useEffect, useState } from 'react'
import { Dashboard } from './views/Dashboard.js'
import { Documentation } from './views/Documentation.js'
import { Billing } from './views/Billing.js'
import { Adherence } from './views/Adherence.js'
import { fetchQueue, fetchAdherence, type QueueItem, type AdherenceRow, type DataSource } from './lib/api.js'

const TABS = ['Dashboard', 'Documentation', 'Billing', 'Adherence'] as const
type Tab = (typeof TABS)[number]

export function App() {
  const [tab, setTab] = useState<Tab>('Dashboard')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [adherence, setAdherence] = useState<AdherenceRow[]>([])
  const [source, setSource] = useState<DataSource>('snapshot')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([fetchQueue(), fetchAdherence()]).then(([q, a]) => {
      setQueue(q.data)
      setAdherence(a.data)
      setSource(q.source)
      setReady(true)
    })
  }, [])

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <div>
            <h1>Throughline</h1>
            <p>Documentation, billing and adherence for outpatient PT</p>
          </div>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((name) => (
            <button key={name} className={name === tab ? 'tab active' : 'tab'} onClick={() => setTab(name)}>
              {name}
            </button>
          ))}
        </nav>
      </header>

      <p className={source === 'live' ? 'source live' : 'source'}>
        {source === 'live'
          ? 'Live data from the local API.'
          : 'Showing a captured snapshot — start the API with npm run api for live data.'}
      </p>

      <main>
        {!ready && <p className="muted">Loading…</p>}
        {ready && tab === 'Dashboard' && <Dashboard queue={queue} adherence={adherence} onJump={setTab} />}
        {ready && tab === 'Documentation' && <Documentation queue={queue} />}
        {ready && tab === 'Billing' && <Billing queue={queue} />}
        {ready && tab === 'Adherence' && <Adherence rows={adherence} />}
      </main>

      <footer>
        <span>Prototype. Fee-schedule values are illustrative, not a licensed CMS file.</span>
      </footer>
    </div>
  )
}
