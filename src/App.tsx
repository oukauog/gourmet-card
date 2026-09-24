import { useCallback, useEffect, useState } from 'react'
import { Toast } from './components/Toast'
import { db } from './db/db'
import { HomeScreen } from './screens/HomeScreen'
import { RegisterScreen } from './screens/RegisterScreen'
import './styles/app.css'

// Screen switching lives only here (no router yet). Replace this with a router later
// (GitHub Pages will likely need hash-based routing; decided in construction 3+).
type Route = { screen: 'home' } | { screen: 'register' }

type DbState = 'opening' | 'ready' | 'error'

function App() {
  const [route, setRoute] = useState<Route>({ screen: 'home' })
  const [dbState, setDbState] = useState<DbState>('opening')
  const [toast, setToast] = useState<string>()

  useEffect(() => {
    db.open().then(
      () => setDbState('ready'),
      (e: unknown) => {
        console.error(e)
        setDbState('error')
      },
    )
  }, [])

  const clearToast = useCallback(() => setToast(undefined), [])

  if (dbState === 'opening') return null
  if (dbState === 'error') {
    return (
      <p className="fatal" role="alert">
        この環境ではデータを保存できません。
        <br />
        プライベートブラウズをオフにしてお試しください。
      </p>
    )
  }

  return (
    <>
      {route.screen === 'home' && <HomeScreen onAdd={() => setRoute({ screen: 'register' })} />}
      {route.screen === 'register' && (
        <RegisterScreen
          onCancel={() => setRoute({ screen: 'home' })}
          onSaved={() => {
            setRoute({ screen: 'home' })
            setToast('保存しました')
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}

export default App
