import { useState } from 'react'
import './App.css'

const round1000 = (n) => Math.round(n / 1000) * 1000
const fmt = (n) => n.toLocaleString('ko-KR') + '원'

// participantIds가 비거나 없으면 전체 참여로 처리
function resolveParticipants(item, people) {
  if (!item.participantIds || item.participantIds.length === 0)
    return people.map(p => p.id)
  return item.participantIds
}

function calcTransactions(people, items) {
  if (people.length < 2) return []
  if (!items.some(i => i.payerId)) return []

  const paid = {}
  const owes = {}
  people.forEach(p => { paid[p.id] = 0; owes[p.id] = 0 })

  items.forEach(item => {
    const participants = resolveParticipants(item, people)
    const share = item.amount / participants.length

    if (item.payerId && paid[item.payerId] !== undefined)
      paid[item.payerId] += item.amount

    participants.forEach(id => {
      if (owes[id] !== undefined) owes[id] += share
    })
  })

  // 잔액 = 낸 돈 - 내야 할 돈  (양수: 받아야, 음수: 내야)
  let balances = people.map(p => ({
    id: p.id, name: p.name, bal: paid[p.id] - owes[p.id],
  }))

  const txns = []
  for (let i = 0; i < 100; i++) {
    const debtors   = balances.filter(b => b.bal < -0.5).sort((a, b) => a.bal - b.bal)
    const creditors = balances.filter(b => b.bal >  0.5).sort((a, b) => b.bal - a.bal)
    if (!debtors.length || !creditors.length) break

    const debtor   = debtors[0]
    const creditor = creditors[0]
    const amount   = Math.min(-debtor.bal, creditor.bal)
    const rounded  = round1000(amount)

    if (rounded > 0) txns.push({ from: debtor.name, to: creditor.name, amount: rounded })

    balances = balances.map(b => {
      if (b.id === debtor.id)   return { ...b, bal: b.bal + amount }
      if (b.id === creditor.id) return { ...b, bal: b.bal - amount }
      return b
    })
  }

  return txns
}

export default function App() {
  const [people,      setPeople]      = useState([])
  const [personName,  setPersonName]  = useState('')

  const [items,       setItems]       = useState([])
  const [itemName,    setItemName]    = useState('')
  const [itemAmount,  setItemAmount]  = useState('')
  const [itemPayerId, setItemPayerId] = useState('')
  // 새 품목의 참여자 — 비어있으면 전체
  const [itemParticipants, setItemParticipants] = useState([])

  const [copied, setCopied] = useState(false)

  /* ── 참여자 추가 ──────────────────────────── */
  const addPerson = () => {
    const name = personName.trim()
    if (!name) return
    setPeople(p => [...p, { id: Date.now(), name }])
    setPersonName('')
  }

  const deletePerson = (id) => {
    setPeople(prev => prev.filter(p => p.id !== id))
    // 해당 참여자가 들어간 품목에서도 제거
    setItems(prev => prev.map(item => ({
      ...item,
      payerId: item.payerId === id ? null : item.payerId,
      participantIds: item.participantIds?.filter(pid => pid !== id) ?? [],
    })))
    setItemParticipants(prev => prev.filter(pid => pid !== id))
  }

  /* ── 품목 추가 ────────────────────────────── */
  const addItem = () => {
    const name   = itemName.trim()
    const amount = parseInt(itemAmount.replace(/,/g, ''), 10)
    if (!name || !amount || amount <= 0) return
    setItems(p => [...p, {
      id: Date.now(), name, amount,
      payerId: itemPayerId || null,
      // 전체 선택이면 빈 배열로 저장 (= 전체)
      participantIds: itemParticipants.length === people.length ? [] : [...itemParticipants],
    }])
    setItemName('')
    setItemAmount('')
    setItemPayerId('')
    setItemParticipants([])
  }

  /* ── 참여자 토글 (품목 입력 시) ──────────── */
  const toggleParticipant = (id) => {
    setItemParticipants(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  // 현재 폼에서 "선택된" 참여자 (비어있으면 전체로 간주)
  const selectedParticipants = itemParticipants.length === 0
    ? people.map(p => p.id)
    : itemParticipants

  /* ── 계산 ─────────────────────────────────── */
  const total        = items.reduce((s, i) => s + i.amount, 0)
  const transactions = calcTransactions(people, items)

  const getPayerName = (payerId) => people.find(p => p.id === payerId)?.name ?? null

  const getParticipantLabel = (item) => {
    const ids = resolveParticipants(item, people)
    if (ids.length === people.length) return null   // 전체 → 표시 안 함
    const names = ids.map(id => people.find(p => p.id === id)?.name).filter(Boolean)
    const excluded = people.filter(p => !ids.includes(p.id)).map(p => p.name)
    return { names, excluded }
  }

  /* ── 1인당 분담금 (품목별 참여 반영) ──────── */
  const perPersonMap = (() => {
    const owes = {}
    people.forEach(p => { owes[p.id] = 0 })
    items.forEach(item => {
      const participants = resolveParticipants(item, people)
      const share = item.amount / participants.length
      participants.forEach(id => { if (owes[id] !== undefined) owes[id] += share })
    })
    return owes
  })()

  /* ── 공유 텍스트 ──────────────────────────── */
  const buildShareText = () => {
    const itemLines = items.map(i => {
      const payer = getPayerName(i.payerId)
      const pl    = getParticipantLabel(i)
      const pInfo = pl ? ` [${pl.names.join(', ')}만 참여]` : ''
      return `• ${i.name}${pInfo}${payer ? ` (${payer} 지불)` : ''}: ${fmt(i.amount)}`
    }).join('\n')

    const perLines = people.map(p =>
      `• ${p.name}: ${fmt(round1000(perPersonMap[p.id] ?? 0))}`
    ).join('\n')

    const txnLines = transactions.length > 0
      ? transactions.map(t => `• ${t.from} → ${t.to}: ${fmt(t.amount)}`).join('\n')
      : '정산 없음'

    return `💰 정산 결과\n\n[품목]\n${itemLines}\n${'─'.repeat(20)}\n합계: ${fmt(total)}\n\n[인원별 분담]\n${perLines}\n\n[정산 방법]\n${txnLines}`
  }

  const handleShare = async () => {
    const text = buildShareText()
    if (navigator.share) {
      try { await navigator.share({ text }); return } catch (e) { void e }
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const canShare = items.length > 0 && people.length > 0

  return (
    <div className="container">
      <h1 className="title">💸 정산 시스템</h1>

      {/* ── 참여자 ── */}
      <section className="card">
        <h2 className="section-title">참여자</h2>
        <div className="input-row">
          <input
            className="input"
            placeholder="이름"
            value={personName}
            onChange={e => setPersonName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPerson()}
          />
          <button className="btn btn-primary" onClick={addPerson}>추가</button>
        </div>
        {people.length > 0 && (
          <ul className="list">
            {people.map(p => (
              <li key={p.id} className="list-item">
                <span className="list-item-name">{p.name}</span>
                <button className="btn-delete" onClick={() => deletePerson(p.id)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 품목 ── */}
      <section className="card">
        <h2 className="section-title">품목</h2>
        <div className="item-form">
          <div className="input-row">
            <input
              className="input"
              placeholder="품목명 (숙소비, 음식값...)"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('amount-input').focus()}
            />
            <input
              id="amount-input"
              className="input input-amount"
              placeholder="금액"
              value={itemAmount}
              onChange={e => setItemAmount(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              inputMode="numeric"
            />
          </div>

          <div className="input-row">
            <select
              className="input select-payer"
              value={itemPayerId}
              onChange={e => setItemPayerId(e.target.value)}
            >
              <option value="">지불자 선택</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn btn-primary" onClick={addItem}>추가</button>
          </div>

          {/* 참여자 선택 — 한 명이라도 있을 때만 표시 */}
          {people.length > 0 && (
            <div className="participant-row">
              <span className="participant-label">참여자</span>
              <div className="participant-chips">
                {people.map(p => {
                  const active = selectedParticipants.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      className={`chip ${active ? 'chip-on' : 'chip-off'}`}
                      onClick={() => toggleParticipant(p.id)}
                    >
                      {active ? '✓' : '✕'} {p.name}
                    </button>
                  )
                })}
              </div>
              <span className="participant-count">
                {selectedParticipants.length}명 ·{' '}
                {people.length > 0 && itemAmount
                  ? fmt(Math.ceil(parseInt(itemAmount || '0') / selectedParticipants.length))
                  : '1/n 분담'}
              </span>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <ul className="list">
            {items.map(item => {
              const payerName = getPayerName(item.payerId)
              const pl        = getParticipantLabel(item)
              return (
                <li key={item.id} className="list-item">
                  <div className="list-item-info">
                    <span className="list-item-name">
                      {item.name}
                      {payerName && <span className="payer-badge">{payerName}</span>}
                    </span>
                    {pl && (
                      <span className="participant-info">
                        <span className="participant-info-names">{pl.names.join(', ')} 참여</span>
                        <span className="participant-info-excluded">{pl.excluded.join(', ')}</span>
                      </span>
                    )}
                  </div>
                  <span className="list-item-amount">{fmt(item.amount)}</span>
                  <button className="btn-delete" onClick={() => setItems(p => p.filter(i => i.id !== item.id))}>✕</button>
                </li>
              )
            })}
            <li className="list-item total-row">
              <span className="list-item-name">합계</span>
              <span className="list-item-amount total-amount">{fmt(total)}</span>
            </li>
          </ul>
        )}
      </section>

      {/* ── 결과 ── */}
      {canShare && (
        <section className="card result-card">
          <h2 className="section-title">정산 결과</h2>

          {/* 인원별 분담금 */}
          <p className="sub-label">인원별 분담금</p>
          <ul className="list per-person-list">
            {people.map(p => (
              <li key={p.id} className="list-item per-person-item">
                <span className="list-item-name">{p.name}</span>
                <span className="list-item-amount">{fmt(round1000(perPersonMap[p.id] ?? 0))}</span>
              </li>
            ))}
            <li className="list-item total-row">
              <span className="list-item-name">합계</span>
              <span className="list-item-amount total-amount">{fmt(total)}</span>
            </li>
          </ul>

          {transactions.length > 0 && (
            <>
              <p className="sub-label">정산 방법</p>
              <ul className="list txn-list">
                {transactions.map((t, i) => (
                  <li key={i} className="list-item txn-item">
                    <span className="txn-from">{t.from}</span>
                    <span className="txn-arrow">→</span>
                    <span className="txn-to">{t.to}</span>
                    <span className="txn-amount">{fmt(t.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <button className="btn btn-kakao" onClick={handleShare}>
            {copied ? '✅ 클립보드에 복사됨!' : '💬 카카오톡으로 공유'}
          </button>
        </section>
      )}
    </div>
  )
}
