import { defaultComboModifier } from './shortkeys.ts'
import { AppOptions } from './types.ts'

export const CUSTOM_ELEMENT_NAME = APP_ID
export const TEMPLATE_ID = `${APP_ID}_template` as const
export const HIGHLIGHT_ALL_ID = `${APP_ID}_all` as const
export const HIGHLIGHT_ONE_ID = `${APP_ID}_one` as const

export const defaultOptions: AppOptions = {
	shortkey: `${defaultComboModifier()}+Shift+F`,
}
