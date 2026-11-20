import { useEffect, useRef, useState } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'demo-textarea',
  title: '입력창(textarea) — `textarea` 옵션 보기',
  notes: [
    '위 막대의 「입력창 보기」를 켜고 끄며 본다. 꺼져 있으면(기본) 입력창은 건드리지 않는다.',
    '「글 길게」로 스크롤바를 만들었다 없앴다 하며 본다. 줄 끝(|)이 빨간 ▼ 바로 아래에 있으면 안 밀린 것이고, ▼ 보다 왼쪽에 있으면 스크롤바에 밀린 것이다. 상자 아래 숫자(상자 폭·글자 폭·오른쪽 여백)로도 보인다.',
    '① 여백 16px · 테두리 기준(border-box): 오른쪽 여백을 스크롤바 폭만큼 줄여 글자 폭을 지킨다.',
    '② 여백 16px · 안쪽 내용 기준(content-box), 폭 240px 고정: 여백을 줄이면 글자 폭은 그대로인 채 상자만 줄어든다 — 그래서 그대로 둔다(글자가 밀린다). `box-sizing: border-box` 를 주면 ①처럼 받는다.',
    '③ 여백 4px: 여백이 스크롤바보다 좁고, 입력창에는 스크롤바를 띄울 수 없어 그대로 둔다(글자가 밀린다).',
  ],
}

// 글은 오른쪽 정렬이다 — 줄 끝(|)이 빨간 ▼ 바로 아래에 있으면 안 밀린 것, 왼쪽으로 벗어나면 밀린 것이다.
const lines = (n: number) => Array.from({ length: n }, (_, i) => `${i + 1}번째 줄 끝|`).join('\n')
const SHORT = lines(3)
const LONG = lines(14)

function Box(p: { title: string; hint: string; className: string; text: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [size, setSize] = useState('')
  useEffect(() => {
    const read = () => {
      const el = ref.current
      if (!el) return
      const s = getComputedStyle(el)
      const text = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)
      setSize(`상자 폭 ${el.offsetWidth} · 글자 폭 ${Math.round(text)} · 오른쪽 여백 ${s.paddingRight}`)
    }
    read()
    const timer = setInterval(read, 200)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="demo-textarea-card">
      <b>{p.title}</b>
      <small>{p.hint}</small>
      {/* 줄 끝이 와야 할 자리 — 입력창과 같은 폭·여백으로 그 위에 둔다. */}
      <div className={`${p.className} demo-textarea-mark`}>줄 끝이 올 자리 ▼</div>
      <textarea ref={ref} className={p.className} value={p.text} readOnly />
      <code>{size}</code>
    </section>
  )
}

export default function DemoTextarea() {
  const [long, setLong] = useState(false)
  const text = long ? LONG : SHORT
  // 이 브라우저에서 스크롤바가 차지하는 폭 — 0 이면 겹쳐 뜨는 환경이라 밀림도 차이도 없다.
  const probe = useRef<HTMLDivElement>(null)
  const [sb, setSb] = useState<number | null>(null)
  useEffect(() => {
    const read = () => probe.current && setSb(probe.current.offsetWidth - probe.current.clientWidth)
    read()
    const timer = setInterval(read, 500)
    return () => clearInterval(timer)
  }, [])

  return (
    <main className="demo-textarea-root">
      <button type="button" onClick={() => setLong(!long)}>
        {long ? '글 짧게 (스크롤바 없애기)' : '글 길게 (스크롤바 만들기)'}
      </button>
      <span className="demo-textarea-sb">
        이 브라우저의 스크롤바 폭: {sb === null ? '…' : `${sb}px`}
        {sb === 0 && ' — 겹쳐 뜨는 스크롤바라 밀림이 없다. 위 막대에서 「스크롤바」를 강제 11px 로 바꾸거나(Firefox 는 안 됨) Chrome 으로 연다'}
      </span>
      <div ref={probe} className="demo-textarea-probe" data-scrollbar="off" />
      <div className="demo-textarea-row">
        <Box title="① 여백 16px · 테두리 기준" hint="box-sizing: border-box" className="demo-textarea-a" text={text} />
        <Box title="② 여백 16px · 안쪽 내용 기준, 폭 240px 고정" hint="box-sizing: content-box — 상자 크기를 못 지켜 그대로 둔다" className="demo-textarea-b" text={text} />
        <Box title="③ 여백 4px" hint="여백이 스크롤바보다 좁다 — 그대로 둔다" className="demo-textarea-c" text={text} />
      </div>
    </main>
  )
}
