import type { AdherenceRow } from '../lib/api.js'
import { percent } from '../lib/api.js'

export function Adherence({ rows }: { rows: AdherenceRow[] }) {
  return (
    <section className="cards">
      {rows.map(({ programId, patient, summary }) => (
        <article key={programId} className="panel card">
          <header className="card-head">
            <h2>{patient}</h2>
            <span className={`pill ${summary.risk}`}>{summary.risk}</span>
          </header>

          <p className="card-score">{percent(summary.score)}<span className="muted"> of prescribed sessions</span></p>

          <ul className="bars">
            {summary.byExercise.map((exercise) => (
              <li key={exercise.exerciseId}>
                <span>{exercise.name}</span>
                <div className="bar" role="img" aria-label={`${exercise.completed} of ${exercise.expected}`}>
                  <div className="bar-fill" style={{ width: `${Math.min(100, exercise.score * 100)}%` }} />
                </div>
                <span className="muted small">{exercise.completed}/{exercise.expected}</span>
              </li>
            ))}
          </ul>

          <dl className="facts">
            <div><dt>Streak</dt><dd>{summary.currentStreak} day{summary.currentStreak === 1 ? '' : 's'}</dd></div>
            <div><dt>Last logged</dt><dd>{summary.daysSinceLastActivity === null ? 'never' : `${summary.daysSinceLastActivity}d ago`}</dd></div>
            <div><dt>Pain</dt><dd>{summary.painTrend}</dd></div>
          </dl>

          <p className="callout">{summary.recommendation}</p>
        </article>
      ))}
    </section>
  )
}
