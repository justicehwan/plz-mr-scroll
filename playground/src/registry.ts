import type { ComponentType } from 'react'

/** 페이지 하나가 내보내는 것 — `src/pages/<폴더>/index.tsx` 의 `default`(컴포넌트)와 `meta`. */
export type PageMeta = {
  /** 주소에 쓰는 이름. 폴더 이름과 같게. */
  id: string
  title: string
  /** 이 페이지의 스크롤 구조 설명 — 어떤 영역이 스크롤되고, 스크롤바를 어떻게 다뤘는지. */
  notes: string[]
}
type PageModule = { default: ComponentType; meta: PageMeta }

const modules = import.meta.glob<PageModule>('./pages/*/index.tsx', { eager: true })

export const pages = Object.values(modules)
  .filter((m) => m.default && m.meta)
  .sort((a, b) => a.meta.id.localeCompare(b.meta.id))
