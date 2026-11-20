import { useEffect, useState } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'odd-legacy',
  title: '옛 포털 — 표 레이아웃·float·인라인 스타일',
  notes: [
    '문서 전체(html): 폭 960px 고정 표 레이아웃이 가운데 정렬. html.page-odd-legacy 에 overflow-y: scroll 을 걸어 세로 스크롤바를 항상 띄워 두는 옛 방식(대처함). 하단 「광고 배너」의 「펼치기」로 문서 길이 변경.',
    '「인기 검색어」(왼쪽 칸): div 높이 140px·overflow:auto. 항목 li 가 float:left + width:100% + 패딩(content-box)이라 가로로 8px 넘쳐 가로 스크롤바가 같이 생기는 버그(대처 없음). 「+3 / -3」으로 줄 수 변경.',
    '「공지사항」 게시판(가운데): 머리글 표와 본문 표가 따로이고 본문 div 는 overflow-y:auto. 머리글 쪽에 padding-right:17px 를 하드코딩해 스크롤바 폭을 가정(17px 일 때만 맞음, 스크롤바가 없을 때도 머리글만 좁아짐). 「글 추가 / 삭제」로 변경.',
    '「실시간 속보」(가운데 아래 왼쪽, float:left): overflow-y:scroll 로 트랙을 항상 보임(대처 없음, 표시만 고정). 2.5초마다 한 줄씩 저절로 늘고 14줄이 되면 3줄로 돌아감. 「자동」 체크로 멈춤.',
    '「포토 갤러리」(가운데 아래 오른쪽, float:right): overflow-y:auto, 썸네일이 float:left 로 88px 씩 흐름. 폭 268px 에서 3열이 딱 맞아, 6장까지는 스크롤바 없이 3열 2줄, 7장부터는 높이 초과 → 스크롤바 → 폭 부족 → 2열로 다시 흐름(스크롤바 때문에 열 수가 바뀜). 「+1 / -1」.',
    '「마이 메뉴」(오른쪽 칸): 인라인 style 로 overflow:scroll(가로·세로 항상 표시) 200x110px. 「가로로 길게」 체크로 안쪽 폭을 420px 로 늘림, 「줄 수」 버튼으로 세로 양 변경. 구식 전역 초기화(* {margin:0;padding:0}) 와 content-box 사용.',
  ],
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const TITLES = ['서비스 점검 안내', '가을 맞이 경품 추첨', '개인정보 처리방침 개정', '회원 등급 제도 변경', '모바일 앱 업데이트', '고객센터 휴무 일정', '이용약관 일부 변경', '포인트 소멸 예정 안내']
const HOT = ['가을 코트', '노트북 할인', '캠핑 의자', '운동화 추천', '전기장판', '겨울 이불', '무선 이어폰', '보온 텀블러']

/** 옛날식 버튼 묶음 */
function Stepper(p: { n: number; set: (n: number) => void; step: number; min?: number; max?: number; unit: string }) {
  const { n, set, step, min = 0, max = 60 } = p
  return (
    <span className="odd-legacy-step">
      <input type="button" value={`+${step}`} onClick={() => set(Math.min(max, n + step))} />
      <input type="button" value={`-${step}`} onClick={() => set(Math.max(min, n - step))} />
      <input type="button" value="비움" onClick={() => set(min)} />
      <span style={{ color: '#666' }}> {n}{p.unit}</span>
    </span>
  )
}

export default function Page() {
  const [hot, setHot] = useState(5)
  const [board, setBoard] = useState(4)
  const [news, setNews] = useState(3)
  const [auto, setAuto] = useState(true)
  const [thumbs, setThumbs] = useState(6)
  const [mini, setMini] = useState(3)
  const [wide, setWide] = useState(false)
  const [ad, setAd] = useState(false)

  // 속보가 저절로 늘어난다(조작 없이 스크롤바가 생겼다 사라짐)
  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => setNews((n) => (n >= 14 ? 3 : n + 1)), 2500)
    return () => clearInterval(t)
  }, [auto])

  return (
    <div className="odd-legacy-root">
      <table align="center" width={960} cellPadding={0} cellSpacing={0} border={0} className="odd-legacy-main">
        <tbody>
          <tr>
            <td colSpan={3} style={{ background: '#003366', padding: 0 }}>
              <table width="100%" cellPadding={0} cellSpacing={0} border={0}>
                <tbody>
                  <tr>
                    <td style={{ width: 200, padding: '10px 14px', color: '#fff', fontSize: 20, fontWeight: 'bold' }}>가상포털</td>
                    <td>
                      <ul className="odd-legacy-gnb odd-legacy-clearfix">
                        {['뉴스', '메일', '카페', '쇼핑', '지식', '게임'].map((m) => (
                          <li
                            key={m}
                            onMouseOver={(e) => (e.currentTarget.style.background = '#0055aa')}
                            onMouseOut={(e) => (e.currentTarget.style.background = '')}
                          >
                            {m}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            {/* 왼쪽 칸 */}
            <td width={180} style={{ verticalAlign: 'top', padding: 8, background: '#eef3f8' }}>
              <div className="odd-legacy-title">인기 검색어</div>
              <div className="odd-legacy-hot">
                <ul>
                  {range(hot).map((i) => (
                    <li key={i}>
                      {i + 1}. {HOT[i % HOT.length]}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ clear: 'both', paddingTop: 6 }}>
                <Stepper n={hot} set={setHot} step={3} unit="줄" />
              </div>
            </td>

            {/* 가운데 칸 */}
            <td width={540} style={{ verticalAlign: 'top', padding: 10 }}>
              <div className="odd-legacy-title">공지사항</div>
              {/* 머리글: 스크롤바 폭 17px 을 가정하고 오른쪽을 비워 둠 */}
              <div style={{ paddingRight: 17, background: '#dde6ef' }}>
                <table width="100%" cellPadding={4} cellSpacing={0} border={0} style={{ fontWeight: 'bold' }}>
                  <tbody>
                    <tr>
                      <td width={40}>번호</td>
                      <td>제목</td>
                      <td width={80} align="right">작성일</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="odd-legacy-board">
                <table width="100%" cellPadding={4} cellSpacing={0} border={0}>
                  <tbody>
                    {range(board).map((i) => (
                      <tr
                        key={i}
                        style={{ borderBottom: '1px solid #ddd' }}
                        onMouseOver={(e) => (e.currentTarget.style.background = '#ffffe0')}
                        onMouseOut={(e) => (e.currentTarget.style.background = '')}
                      >
                        <td width={40}>{board - i}</td>
                        <td>{TITLES[i % TITLES.length]}</td>
                        <td width={80} align="right">2026.11.{String(1 + (i % 28)).padStart(2, '0')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '6px 0' }}>
                <Stepper n={board} set={setBoard} step={4} unit="건" />
              </div>

              <div className="odd-legacy-clearfix">
                <div className="odd-legacy-news-wrap">
                  <div className="odd-legacy-title">실시간 속보</div>
                  <div className="odd-legacy-news">
                    {range(news).map((i) => (
                      <p key={i}>
                        <b style={{ color: '#c00' }}>{String(9 + Math.floor(i / 6)).padStart(2, '0')}:{String((i % 6) * 10).padStart(2, '0')}</b> 속보 {i + 1}번째 소식
                      </p>
                    ))}
                  </div>
                  <label style={{ fontSize: 11 }}>
                    <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> 자동
                  </label>{' '}
                  <Stepper n={news} set={setNews} step={2} unit="줄" />
                </div>
                <div className="odd-legacy-gallery-wrap">
                  <div className="odd-legacy-title">포토 갤러리</div>
                  <div className="odd-legacy-gallery odd-legacy-clearfix">
                    {range(thumbs).map((i) => (
                      <div key={i} className="odd-legacy-thumb" style={{ background: `hsl(${(i * 47) % 360}, 45%, 78%)` }}>
                        사진 {i + 1}
                      </div>
                    ))}
                  </div>
                  <div style={{ paddingTop: 4 }}>
                    <Stepper n={thumbs} set={setThumbs} step={1} unit="장" max={40} />
                  </div>
                </div>
              </div>
            </td>

            {/* 오른쪽 칸 */}
            <td width={240} style={{ verticalAlign: 'top', padding: 6, background: '#f7f1e6' }}>
              <div className="odd-legacy-title">마이 메뉴</div>
              {/* 전부 인라인 스타일 */}
              <div style={{ width: 200, height: 110, overflow: 'scroll', border: '1px solid #666', background: '#fff', fontSize: 12 }}>
                <div style={{ width: wide ? 420 : 'auto', whiteSpace: wide ? 'nowrap' : 'normal', padding: '2px 4px' }}>
                  {range(mini).map((i) => (
                    <div key={i} style={{ borderBottom: '1px dashed #bbb', background: i % 2 ? '#fafafa' : '#fff' }}>
                      {i + 1}. 내가 쓴 글 · 댓글 · 쪽지 · 즐겨찾기 모음 바로가기
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ paddingTop: 6 }}>
                <label style={{ fontSize: 11 }}>
                  <input type="checkbox" checked={wide} onChange={(e) => setWide(e.target.checked)} /> 가로로 길게
                </label>
                <br />
                <Stepper n={mini} set={setMini} step={3} unit="줄" />
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan={3} style={{ background: '#ccc', padding: 0 }}>
              <div style={{ height: ad ? 700 : 60, background: 'repeating-linear-gradient(45deg,#ffe9a8,#ffe9a8 12px,#ffd36a 12px,#ffd36a 24px)', textAlign: 'center', paddingTop: 20, fontWeight: 'bold' }}>
                광고 배너 ({ad ? '펼침 700px' : '접힘 60px'}){' '}
                <input type="button" value={ad ? '접기' : '펼치기'} onClick={() => setAd(!ad)} />
              </div>
              <div style={{ padding: 8, fontSize: 11, color: '#555' }}>© 가상포털 · 이 화면은 시험용 가짜 포털입니다.</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
