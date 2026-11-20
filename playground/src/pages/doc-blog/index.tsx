import { useEffect, useState } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'doc-blog',
  title: '블로그 글 (100vw 히어로·넓은 표·곁가지)',
  notes: [
    '페이지 전체: 대처는 html { overflow-x: hidden } 뿐(넘치는 가로를 숨기는 어설픈 방법). 본문 열은 max-width 720px + margin 0 auto, box-sizing 초기화 없음(content-box, 좌우 padding 20px 가 폭에 더해짐). 조작: 「본문 접기」(280px 로 줄임), 「단락 -3/+3」으로 창보다 짧게/길게.',
    '전체 폭 히어로와 바닥글: width 100vw + margin-left calc(50% - 50vw) 로 열 밖으로 빼냄. 세로 스크롤바가 있으면 100vw 가 보이는 영역보다 넓어 가로로 넘치고 오른쪽이 잘림(숨김으로 가림).',
    '왼쪽 공유 막대(position: fixed): left 를 (100vw - --doc-blog-sbw)/2 - 440px 로 계산. --doc-blog-sbw 는 마운트와 창 크기 변경 때만 JS 로 측정하므로, 이후 스크롤바가 생기거나 사라지면 값이 낡는다.',
    '오른쪽 곁가지 메모: 열 안쪽 relative 기준으로 left:100% absolute 로 열 밖에 놓음. 넓은 표(margin 0 -100px)와 떠 있는 그림(margin-right -60px)도 열 밖으로 삐져나옴.',
    '코드 상자: overflow: auto + max-height 140px, 대처 없음. 조작: 「코드 줄 +8/-8」로 세로 스크롤바 생기고 사라짐, 줄이 아주 긴 것도 있어 가로 스크롤바도 생김.',
    '넓은 표: 래퍼 overflow-x: auto, 대처 없음. 조작: 「표 열 늘리기」로 가로 스크롤바 생기고 사라짐.',
    '댓글 상자: height 260px + overflow-y: auto, padding-right 15px 로 스크롤바 폭을 대충 짐작해 비워 둠(고정값 대처). 조작: 「댓글 더 보기(+5)」, 「댓글 비우기」.',
    '늦게 불어나는 내용: 그림 3개가 높이 0 에서 시차를 두고(0.8/1.6/2.4초) 커짐(「그림 다시 불러오기」). 본문 접기/펼치기도 내용 양을 바꿈.',
  ],
}

const S = [
  '어제 저녁에는 오래된 서랍을 정리하다가 예전 메모를 발견했다.',
  '그 메모에는 단순한 숫자와 짧은 문장만 적혀 있었는데, 읽다 보니 그때의 분위기가 되살아났다.',
  '기록은 결국 미래의 나에게 보내는 편지라는 생각이 든다.',
  '작은 습관 하나가 한 해를 바꾸는 경우를 여러 번 보았다.',
  '무엇보다 중요한 것은 꾸준함이라는 말이 처음에는 진부했지만, 이제는 조금 다르게 들린다.',
]
const para = (i: number) => S[i % 5] + ' ' + S[(i + 1) % 5] + ' ' + S[(i + 3) % 5]
const IMG_DELAY = [800, 1600, 2400]

export default function Page() {
  const [paras, setParas] = useState(10)
  const [closed, setClosed] = useState(false)
  const [code, setCode] = useState(4)
  const [cols, setCols] = useState(4)
  const [comments, setComments] = useState(4)
  const [loaded, setLoaded] = useState([false, false, false])
  const [run, setRun] = useState(0)

  // 스크롤바 폭을 마운트·창 크기 변경 때만 측정 (이후 변화는 따라가지 못함)
  useEffect(() => {
    const measure = () => document.documentElement.style.setProperty('--doc-blog-sbw', `${window.innerWidth - document.documentElement.clientWidth}px`)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // 그림이 시차를 두고 늦게 뜬다
  useEffect(() => {
    setLoaded([false, false, false])
    const ts = IMG_DELAY.map((ms, i) => window.setTimeout(() => setLoaded((l) => l.map((v, j) => (i === j ? true : v))), ms))
    return () => ts.forEach(window.clearTimeout)
  }, [run])

  const img = (i: number, h: number) => (
    <div className="doc-blog-img" style={{ height: loaded[i] ? h : 0 }}>그림 {i + 1} ({h}px, 늦게 뜸)</div>
  )

  return (
    <div>
      <div className="doc-blog-head">
        <div className="doc-blog-head-in"><b>느린 기록</b><span>글 · 모음 · 소개</span></div>
      </div>

      <div className="doc-blog-share" aria-label="공유"><button>가</button><button>나</button><button>다</button></div>

      <article className="doc-blog-article">
        <h1>서랍 속 메모가 알려 준 것</h1>
        <div className="doc-blog-meta">2026년 11월 19일 · 읽는 데 7분</div>
        <div className="doc-blog-hero">전체 폭 히어로 (100vw)</div>
        <aside className="doc-blog-side">곁가지: 이 메모는 열 오른쪽 밖에 absolute 로 놓여 있다.</aside>

        <div className="doc-blog-tools">
          <button onClick={() => setClosed((v) => !v)}>본문 {closed ? '펼치기' : '접기'}</button>
          <button onClick={() => setParas((n) => n + 3)}>단락 +3</button>
          <button onClick={() => setParas((n) => Math.max(0, n - 3))}>단락 -3</button>
          <button onClick={() => setCode((n) => n + 8)}>코드 줄 +8</button>
          <button onClick={() => setCode((n) => Math.max(0, n - 8))}>코드 줄 -8</button>
          <button onClick={() => setCols((n) => (n === 4 ? 14 : 4))}>표 열 {cols === 4 ? '늘리기' : '줄이기'}</button>
          <button onClick={() => setRun((n) => n + 1)}>그림 다시 불러오기</button>
        </div>

        <div className={`doc-blog-clip${closed ? ' closed' : ''}`}>
          <p>{para(0)}</p>
          <div className="doc-blog-float">{img(0, 160)}</div>
          <p>{para(1)}</p>
          <blockquote className="doc-blog-quote">「기록하지 않은 하루는 사라진 하루다.」</blockquote>
          <p>{para(2)}</p>
          <div className="doc-blog-clear" />
          {img(1, 240)}
          <p>{para(3)}</p>

          <div className="doc-blog-pre">
            {['// 메모를 정리하는 작은 스크립트', ...Array.from({ length: code }, (_, i) => `const note${i} = readFile('memo-${i}.txt', { encoding: 'utf-8', normalize: true, trim: true })`)].join('\n')}
          </div>

          <div className="doc-blog-wide">
            <table>
              <thead><tr>{Array.from({ length: cols }, (_, c) => <th key={c}>항목 {c + 1}</th>)}</tr></thead>
              <tbody>
                {[0, 1, 2].map((r) => <tr key={r}>{Array.from({ length: cols }, (_, c) => <td key={c}>기록 {r}-{c} 내용이 조금 길다</td>)}</tr>)}
              </tbody>
            </table>
          </div>

          {Array.from({ length: paras }, (_, i) => <p key={i}>{para(i + 4)}</p>)}
          {img(2, 200)}
        </div>

        <h3>댓글</h3>
        <div className="doc-blog-tools">
          <button onClick={() => setComments((n) => n + 5)}>댓글 더 보기(+5)</button>
          <button onClick={() => setComments(0)}>댓글 비우기</button>
        </div>
        <div className="doc-blog-comments">
          {Array.from({ length: comments }, (_, i) => <div key={i} className="doc-blog-comment"><b>독자{i + 1}</b> {para(i)}</div>)}
        </div>
      </article>

      <footer className="doc-blog-foot">© 느린 기록 · 전체 폭 바닥글 (100vw)</footer>
    </div>
  )
}
