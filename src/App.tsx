import { useCallback, useEffect, useState } from 'react'
import { Toast } from './components/Toast'
import { db } from './db/db'
import { navigate, replaceRoute, useHashRoute } from './router/useHashRoute'
import { HomeScreen } from './screens/HomeScreen'
import { RegisterScreen } from './screens/RegisterScreen'
import { ShopScreen } from './screens/ShopScreen'
import './styles/app.css'

type DbState = 'opening' | 'ready' | 'error'

function App() {
  // Screens follow the URL hash (#/, #/register, #/shop/<id>); see src/router/.
  const route = useHashRoute()
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
      {route.screen === 'home' && (
        <HomeScreen
          onAdd={() => navigate({ screen: 'register' })}
          onOpenShop={(id) => navigate({ screen: 'shop', id })}
        />
      )}
      {route.screen === 'register' && (
        <RegisterScreen
          // Not history.back(): after reloading #/register, back would leave the app.
          onCancel={() => navigate({ screen: 'home' })}
          onSaved={() => {
            // Replace so that "back" does not return to the filled-in form.
            replaceRoute({ screen: 'home' })
            setToast('保存しました')
          }}
        />
      )}
      {route.screen === 'shop' && (
        <ShopScreen
          key={route.id}
          shopId={route.id}
          onBack={() => navigate({ screen: 'home' })}
          onDeleted={() => {
            replaceRoute({ screen: 'home' })
            setToast('削除しました')
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}

export default App
