import { useCallback, useEffect, useRef, useState } from 'react'
import { Toast } from './components/Toast'
import { db } from './db/db'
import { seedUseTags } from './db/seedUseTags'
import { navigate, replaceRoute, useHashRoute } from './router/useHashRoute'
import { EditScreen } from './screens/EditScreen'
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
  // Shop id whose edit screen was opened from its shop page in this session: leaving the edit
  // screen then uses history.back(). Otherwise (URL opened directly / reloaded) replaceRoute,
  // so that "back" never returns to the edit screen.
  const editOpenedFrom = useRef<string>(undefined)

  useEffect(() => {
    db.open().then(
      async () => {
        // initial use tags, once (errors are only logged: the app works without them)
        await seedUseTags().catch((e: unknown) => console.error(e))
        setDbState('ready')
      },
      (e: unknown) => {
        console.error(e)
        setDbState('error')
      },
    )
  }, [])

  const clearToast = useCallback(() => setToast(undefined), [])

  useEffect(() => {
    if (route.screen === 'home' || route.screen === 'register') editOpenedFrom.current = undefined
  }, [route])

  const openEdit = (id: string) => {
    editOpenedFrom.current = id
    navigate({ screen: 'edit', id })
  }
  const leaveEdit = (id: string) => {
    if (editOpenedFrom.current === id) {
      editOpenedFrom.current = undefined
      window.history.back()
    } else {
      replaceRoute({ screen: 'shop', id })
    }
  }

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
          onSaved={(id) => {
            // Replace so that "back" does not return to the filled-in form (back goes to the list).
            replaceRoute({ screen: 'shop', id })
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
          onEdit={() => openEdit(route.id)}
        />
      )}
      {route.screen === 'edit' && (
        <EditScreen
          key={route.id}
          shopId={route.id}
          onDone={(saved) => {
            leaveEdit(route.id)
            if (saved) setToast('保存しました')
          }}
          onBackToList={() => navigate({ screen: 'home' })}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}

export default App
