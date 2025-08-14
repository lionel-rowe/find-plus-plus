import { AppOptions } from './types.ts'

const UUID = 'ed75bf8f-8636-4cec-99d8-f444bb383061'

export const APP_ID = `find-plus-plus-${UUID}`
export const TEMPLATE_ID = `${APP_ID}_template`
export const HIGHLIGHT_ALL_ID = `${APP_ID}_all`
export const HIGHLIGHT_ONE_ID = `${APP_ID}_one`
export const CUSTOM_ELEMENT_NAME = `${APP_ID}`

export const defaultOptions: AppOptions = {
	shortkey: 'Control+Shift+F',
}
