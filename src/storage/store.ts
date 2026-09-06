import type { AppData } from './types.ts'

export interface Store {
  load(): Promise<AppData>
  save(data: AppData): Promise<void>
}
