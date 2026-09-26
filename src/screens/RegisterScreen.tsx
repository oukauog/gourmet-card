import { ShopForm } from '../components/form/ShopForm'
import { createShopFromForm } from '../db/saveShopForm'
import { emptyShopForm, shopFormToData } from '../lib/shopForm'

interface Props {
  onCancel: () => void
  onSaved: (shopId: string) => void
}

// read once: the form keeps its own state
const EMPTY = emptyShopForm()

/**
 * Register screen (spec 4.2): the shared form, empty. Photos + name are on the first screen and
 * the save button is fixed at the bottom (10-second registration); the optional items follow.
 */
export function RegisterScreen({ onCancel, onSaved }: Props) {
  return (
    <ShopForm
      title="お店を登録"
      initialValues={EMPTY}
      confirmDiscard={false}
      onCancel={onCancel}
      onSubmit={async (values, photos) => {
        const shop = await createShopFromForm(
          shopFormToData(values),
          photos.flatMap((s) => ('photo' in s ? [s.photo] : [])),
        )
        onSaved(shop.id)
      }}
    />
  )
}
