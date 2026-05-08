import { useState } from 'react'
import './App.css'

const round1000 = (n) => Math.round(n / 1000) * 1000
const fmt = (n) => n.toLocaleString('ko-KR') + '원'

function calcTransactions(people, items) {
  if (people.length < 2) return []
  if (!items.some(i => i.payerId)) return []

  const paid = {}
  people.forEach(p => { paid[p.id] = 0 })
  items.forEach(item => {
    if (item.payerId && paid[item.payerId] !== undefined) {
      paid[item.payerId] += item.amount
    }
  })

  const total = items.reduce((s, i) => s + i.amount, 0)
  const fairShare = total / people.length

  // positive = 받아야 함, negative = 내야 함
  let balances = people.map(p => ({ id: p.id, name: p.name, bal: paid[p.id] - fairShare }))

  const txns = []
  for (let i = 0; i < 100; i++) {
    const debtors = balances.filter(b => b.bal < -0.5).sort((a, b) => a.bal - b.bal)
    const creditors = balances.filter(b => b.bal > 0.5).sort((a, b) => b.bal - a.bal)
    if (!debtors.length || !creditors.length) break

    const debtor = debtors[0]
    const creditor = creditors[0]
    const amount = Math.min(-debtor.bal, creditor.bal)
    const rounded = round1000(amount)

    if (rounded > 0) txns.push({ from: debtor.name, to: creditor.name, amount: rounded })

    balances = balances.map(b => {
      if (b.id === debtor.id) return { ...b, bal: b.bal + amount }
      if (b.id === creditor.id) return { ...b, bal: b.bal - amount }
      return b
    })
  }

  return txns
}

export default function App() {
  const [items, setItems] = useState([])
  const [itemName, setItemName] = useState('')
  const [itemAmount, setItemAmount] = useState('')
  const [itemPayerId, setItemPayerId] = useState('')
  const [people, setPeople] = useState([])
  const [personName, setPersonName] = useState('')
  const [copied, setCopied] = useState(false)

  const addItem = () => {
    const name = itemName.trim()
    const amount = parseInt(itemAmount.replace(/,/g, ''), 10)
    if (!name || !amount || amount <= 0) return
    setItems(p => [...p, { id: Date.now(), name, amount, payerId: itemPayerId || null }])
    setItemName('')
    setItemAmount('')
    setItemPayerId('')
  }

  const addPerson = () => {
    const name = personName.trim()
    if (!name) return
    setPeople(p => [...p, { id: Date.now(), name }])
    setPersonName('')
  }

  const total = items.reduce((s, i) => s + i.amount, 0)
  const perPerson = people.length > 0 ? round1000(total / people.length) : 0
  const transactions = calcTransactions(people, items)

  const getPayerName = (payerId) => people.find(p => p.id === payerId)?.name ?? null

  const buildShareText = () => {
    const itemLines = items.map(i => {
      const payer = getPayerName(i.payerId)
      return `• ${i.name}${payer ? ` (${payer} 지불)` : ''}: ${fmt(i.amount)}`
    }).join('\n')

    const txnLines = transactions.length > 0
      ? transactions.map(t => `• ${t.from} → ${t.to}: ${fmt(t.amount)}`).join('\n')
      : '정산 없음'

    return `💰 정산 결과\n\n[품목]\n${itemLines}\n${'─'.repeat(20)}\n합계: ${fmt(total)}\n\n[인원] ${people.length}명\n[1인당] ${fmt(perPerson)}\n\n[정산 방법]\n${txnLines}`
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

      {/* 참여자 - 먼저 입력해야 품목에서 지불자 선택 가능 */}
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
                <button className="btn-delete" onClick={() => setPeople(prev => prev.filter(x => x.id !== p.id))}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 품목 */}
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
        </div>

        {items.length > 0 && (
          <ul className="list">
            {items.map(item => {
              const payerName = getPayerName(item.payerId)
              return (
                <li key={item.id} className="list-item">
                  <span className="list-item-name">
                    {item.name}
                    {payerName && <span className="payer-badge">{payerName}</span>}
                  </span>
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

      {/* 결과 */}
      {canShare && (
        <section className="card result-card">
          <h2 className="section-title">정산 결과</h2>
          <div className="result-summary">
            <div className="result-row">
              <span>총 합계</span>
              <span className="result-value">{fmt(total)}</span>
            </div>
            <div className="result-row">
              <span>인원</span>
              <span className="result-value">{people.length}명</span>
            </div>
            <div className="result-row highlight">
              <span>1인당</span>
              <span className="result-value highlight-value">{fmt(perPerson)}</span>
            </div>
          </div>

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
