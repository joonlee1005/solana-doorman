Capstone architecture v4
# On-Chain Ticketing System with Anti-Scalping Enforcement

`capstone_architecture_v4.md` · 2026-08-03
변경 요약 (v3 → v4): Metaplex Core 제거(스택 모순 해소) · 원자성 불변식 명문화 · 양도 횟수 제한을 MVP로 승격(복합 공격 차단) · `min()` 순서 정의 · Registry 신뢰 경계 명시 · 환불 시맨틱 정정 · 영국 규제 표현 정확화 · Over-enforcement 프레이밍 추가

---

## 1. Problem Statement

**기존 프레이밍**: "암표가 문제다"
**재프레이밍**: 암표를 금지하는 법은 이미 있다. 문제는 그 법을 집행할 수단이 없다는 것이다.

법적 규제는 사후 처벌 방식이다 — 적발, 입증, 처벌에 비용이 든다. 온체인 강제는 위반 트랜잭션 자체가 실행되지 않도록 만든다.

> **핵심 논지 (thesis)**: 사후 처벌(post-hoc punishment) → 사전 강제(ex-ante enforcement). "illegal" → "structurally impossible"

### 1.1 규제 타이밍 (시장 진입 근거)

| 지역 | 상태 | 내용 |
|---|---|---|
| **한국** | **시행 확정 (2026.8.28)** | 개정 공연법·국민체육진흥법 (1.29 국회 통과, 2.28 공포). 매크로 사용 여부 무관하게 재판매 목적 부정구매, 상습·영업 목적의 구입가 초과 판매를 금지. 위반 시 판매금액 50배 이하 과징금 + 부정이익 몰수·추징 |
| 영국 | 초안 단계 | Draft Ticket Tout Ban Bill (2026.5.13 King's Speech에서 발표). 액면가(+불가피 수수료) 초과 재판매 금지, 플랫폼 수수료 상한, 구매 한도 초과 재판매 금지 방향. **사전 입법 검토(pre-legislative scrutiny) 대상 초안으로, 최종 입법까지 수년 소요 가능** — "규제 방향의 국제적 수렴" 근거로만 인용 |
| 미국 | 주별 상이 | CA 금지, NY 상한제, FL 자유. 연방 통일 규제 없음 → 관할권별 정책 분기가 필요하다는 설계 근거 |
| 온타리오 | 시행 중 | 액면가 상한 |

- 데모데이(8/17)가 한국 법 시행일(8/28) 직전 — 시장 타이밍상 의미 있음
- 기존 프로덕션 시스템(GET Protocol, 400M+ 티켓 발급)은 로열티 모델을 쓰지, 가격 상한 강제는 구현하지 않음 → 규제 변화가 만드는 수요를 아무 시스템도 커버하지 못하는 공백 지점

### 1.2 법 vs 프로토콜의 강제 범위 (Over-enforcement by design)

한국 개정법의 초과 판매 금지에는 "상습적 또는 영업 목적" 요건이 있다. 프로토콜은 판매자의 목적·상습성을 판별할 수 없으므로 **모든 초과 재판매를 차단하는 보수적 강제**를 택한다.

- 법보다 넓은 강제이지만, 법이 금지하는 행위의 상위집합(superset)을 막는 것이므로 법 준수는 항상 보장됨
- 이는 결함이 아니라 프로토콜 강제의 본질적 속성 — 발표 시 선제적으로 명시

---

## 2. Core Design

### 2.1 티켓 모델 — Token-2022 단독

| 구성 | 선택 |
|---|---|
| 티켓 자산 | Token-2022 Mint (supply 1) |
| 강제 메커니즘 | **Default Account State Extension (Frozen)** — 모든 token account가 동결 상태로 생성됨 |
| Freeze Authority | 프로그램 PDA (사용자·주최자 아님) |
| 메타데이터 | MetadataPointer + TokenMetadata Extension (동일 mint 내 해결) |
| 체크인 | 소각이 아닌 **상태 전이** — 참석 증빙으로 티켓 보존 |

> v3에서 병기했던 Metaplex Core는 **제거**. Core는 token account 개념이 없는 단일 Asset 모델이라 Default Account State가 적용 불가 — 본 아키텍처와 구조적으로 양립하지 않음 (§6 기각 목록 참조).

### 2.2 탈출 경로 (2개)

| 경로 | 메커니즘 | 제약 |
|---|---|---|
| 반납 (capped resale) | Resale Vault 반납 → bid queue 앞순위에 재배정 | 정책 상한가 이하 |
| 지정 양도 | Transfer Offer PDA → 지정 수신자만 claim | 원가 고정 · **티켓당 1회 한정 + 쿨다운** (§5) |

### 2.3 결제 통화

**USDC** — 액면가가 법적 정의(face value)와 정확히 매핑되도록. SOL 가격 변동성이 "정가"라는 법적 개념을 흐리는 걸 방지. 가격 검증은 동일 통화(USDC) 내 비율 비교로 수행되므로 환율 변동이 상한 비율 자체를 훼손하지 않음 (KRW 환산 시점 문제는 §7 한계 참조).

---

## 3. Enforcement Invariant — 원자성 (구현 핵심)

Freeze/Thaw 강제가 성립하기 위한 불변식:

> **INV-1**: 티켓이 thaw 상태로 존재하는 순간은 재판매 instruction 실행 중뿐이다.
> **INV-2**: thaw만 수행하는 단독 instruction은 프로그램에 존재하지 않는다.
> **INV-3**: 결제(USDC) 검증과 티켓 전송은 동일 instruction 내에서 원자적으로 일어난다.

```rust
pub fn execute_resale(ctx: Context<ExecuteResale>, price: u64) -> Result<()> {
    // ① 정책 해석: 스냅샷과 현행 레지스트리 중 더 제한적인 쪽
    let policy = ResalePolicy::more_restrictive(
        &ctx.accounts.event.policy_snapshot,
        &ctx.accounts.jurisdiction.current_policy,
    );
    // ② 가격 상한 검증 — Transfer Hook이 구조적으로 할 수 없는 부분
    require!(price <= policy.max_price(ctx.accounts.event.face_value),
             TicketError::PriceExceedsCap);
    // ③~⑥ 원자적 실행 (단일 instruction)
    thaw(&ctx, seller_ata)?;                       // program PDA 서명
    transfer_usdc(buyer, seller, price)?;          // 결제와
    transfer_ticket(seller_ata, buyer_ata)?;       // 전송이 같은 tx
    freeze(&ctx, seller_ata)?;
    freeze(&ctx, buyer_ata)?;                      // 즉시 재동결
    Ok(())
}
```

이 원자성이 곧 "Transfer Hook 대비 Freeze/Thaw 채택"의 실질적 귀결이다: Hook은 전송 시점에 결제 금액을 관찰할 수 없지만, 프로그램이 전송 경로를 독점하면 결제와 전송을 하나의 검증 단위로 묶을 수 있다.

---

## 4. Policy Architecture — 이원 관할권 체계

```
Jurisdiction Registry PDA   (법적 상한선 · 재배포 없이 업데이트)
        ↓  claim 시점에 more_restrictive() 적용
Event PDA                   (생성 시점 ResalePolicy 스냅샷 저장)
```

법이 바뀌어도 재배포 없이 즉시 반영. 법 개정 시점(예: 한국 8/28)에 자동으로 새 정책이 적용되는 구조. **데모 시나리오**: 레지스트리 업데이트 tx 하나 → 기존 이벤트의 재판매 상한이 즉시 변경되는 것을 라이브 시연.

### 4.1 ResalePolicy와 제한성 순서 (total order 정의)

```rust
pub enum ResalePolicy {
    Unrestricted,             // 무규제 (일부 미국 주)
    Capped { max_bps: u16 },  // 상한형 (한국·영국 방향 등)
    NonTransferable,          // 전면 금지
}

// 제한성 순서 (명시적 정의 — enum 기본 비교에 의존하지 않음):
// NonTransferable  >  Capped{작은 max_bps}  >  Capped{큰 max_bps}  >  Unrestricted
impl ResalePolicy {
    pub fn more_restrictive(a: &Self, b: &Self) -> Self {
        use ResalePolicy::*;
        match (a, b) {
            (NonTransferable, _) | (_, NonTransferable) => NonTransferable,
            (Capped { max_bps: x }, Capped { max_bps: y }) =>
                Capped { max_bps: *x.min(y) },
            (Capped { max_bps }, Unrestricted)
            | (Unrestricted, Capped { max_bps }) => Capped { max_bps: *max_bps },
            (Unrestricted, Unrestricted) => Unrestricted,
        }
    }
}
```

### 4.2 신뢰 경계 (Trust Boundary) — 명시적 선언

| 계층 | 신뢰 주체 | 성격 |
|---|---|---|
| Registry 업데이트 권한 | 프로토콜 거버넌스 (MVP: 단일 authority 키) | 오프체인 법률 → 온체인 파라미터 매핑은 본질적으로 오라클 문제. 온체인이 해결할 수 없음을 인정 |
| 이벤트의 관할권 선택 | 주최자 자가 신고 | 공연장의 물리적 위치를 온체인이 검증할 수 없음. 허위 신고(jurisdiction shopping)는 주최자의 **법적 책임** 영역 — 프로토콜은 신고된 관할권에 대한 강제를 보장 |

정직한 프레이밍: 이 시스템은 "법을 코드로 완전 대체"가 아니라 **"신고된 정책의 위반을 기술적으로 불가능하게"** 만든다.

---

## 5. 재판매 경로 상세

### 5.1 Bid Queue (Buyer-First)

- 구매자가 USDC를 **선입금** (에스크로)
- 판매자는 큐 맨 앞만 채울 수 있음 — 임의 상대 지정 불가
- MVP 범위: 이벤트당 **단일 FIFO 큐** (티어별 큐·부분체결은 post-MVP)

효과:
1. 사이드페이먼트를 가능하게 하는 **프라이빗 협상 채널 자체를 제거**
2. 반환 재고에 대한 봇 새로고침 레이스 컨디션 해결
3. 공개적이고 유동적인 재판매 시장 억제 → 대량화·자동화 스캘핑의 경제성 제거 (상한가 이하 판매만 가능하므로 큐를 봇으로 선점해도 재판매 차익이 0 이하)

**시맨틱 정정 (v3 "환불" 표현 수정)**: 반납 경로는 보장된 환불(guaranteed refund)이 아니라 **상한가 재판매 대기(capped resale)**다. 큐가 비어 있으면 판매자는 매수자가 나타날 때까지 대기한다. 주최자 선택 옵션으로 환불 풀(organizer-backed refund pool)을 둘 수 있으나 MVP 범위 외 — 발표·UI에서 용어를 정확히 사용.

### 5.2 지정 양도 (Transfer Offer PDA) — 양도 횟수 제한 포함 (MVP 승격)

- 원가 고정, 지정 수신자만 claim 가능
- **티켓당 지정 양도 1회 한정** (`transfer_count: u8`, ticket state에 기록)
- **쿨다운**: 구매 후 N시간 이내 양도 불가 (파라미터화)

v3에서 "향후 완화 방향(미구현)"이었던 이 두 장치를 MVP로 승격하는 이유는 §7.1의 복합 공격을 코드 수준에서 차단하기 위함이다. 구현 비용은 카운터 1개 + 타임스탬프 비교 수준으로 낮다.

---

## 6. Rejected Alternatives (설계 판단 근거)

| 대안 | 기각 이유 |
|---|---|
| Non-Transferable Extension | 영구 잠금 → 반납·양도 경로와 양립 불가 |
| Transfer Fee Extension | 전송 "수량" 기준 수수료라 SOL/USDC 분배 불가 |
| Transfer Hook (가격 강제용) | **결제 금액을 관찰할 수 없음** → 가격 상한 강제가 구조적으로 불가능 (Freeze/Thaw 채택의 결정적 근거) |
| **Metaplex Core** *(v4 추가)* | token account가 없는 단일 Asset 모델 → Default Account State 적용 불가. FreezeDelegate 플러그인으로 유사 구현은 가능하나 SPL 생태계(ATA, wallet-adapter 표준 흐름)와의 정합성에서 Token-2022가 우위 |
| Waitlist | Bid queue로 대체 (프라이빗 채널 제거 효과가 더 큼) |
| x402 / AI 에이전트 결제 | 문제정의("결제 트리거 방식")와 축이 다름 — 재판매 정책 강제와 무관 |
| 봇 대량구매(매크로) 방지 | 지갑 익명성 때문에 온체인에서 정상 구매와 구분 불가. 구매 단계 문제로 스코프(유통·재판매 단계)와 다름 — 의도적 제외. **단, 봇 구매가 재판매 단계 우회와 결합하는 복합 경로는 §7.1에서 별도 방어** |

---

## 7. Known Limitations — 정직한 경계 선언

### 7.1 복합 공격: 봇 선점 + 지정 양도 + 오프체인 사이드페이먼트

**공격 시나리오**: 봇으로 1차 판매·큐를 선점 → 오프체인에서 매수자와 웃돈 합의 → 지정 양도(원가)로 전달 + 사이드페이먼트 수령.

**방어 (v4에서 MVP 승격)**:
- 지정 양도 **1회 제한** → 티켓 1장 = 최대 1건의 오프체인 협상. 재양도 불가이므로 중개상(reseller chain)이 성립하지 않음
- 쿨다운 → 즉시 회전 불가, 자금 회전율 붕괴
- 결과: 1,000장 스캘핑 = 1,000번의 개별 프라이빗 협상 + 1,000개 지갑의 자금 잠김. **규모의 경제가 성립하지 않음**

### 7.2 오프체인 사이드페이먼트 자체

지정 양도 경로는 원가 고정이지만, 당사자끼리 온체인 외부에서 추가 금액을 주고받는 것은 막을 수 없다.

왜 그래도 의미가 있는가:
1. 법적 강제(뇌물수수 금지, 탈세 방지)도 동일한 한계를 가진다 — 목적은 "100% 물리적 차단"이 아니라 **위반 비용·마찰을 대량화 불가능한 수준까지 높이는 것**
2. 실제 암표 문제의 본체는 봇 대량구매 후 공개 리셀 마켓(StubHub 등)에서의 **유동적 재판매** — 이 시스템은 정확히 이 공개 유동성 시장을 제거한다
3. Bid queue 경로는 프라이빗 협상 채널이 애초에 없어 이 한계에서 자유롭다. 지정 양도는 "소매(친구 간) 수준 예외 경로"로 계층화되며, 1회 제한이 이 계층 구분을 코드로 강제한다

**발표 프레이밍**:
> "이 시스템은 사이드페이먼트를 통한 개별 우회를 100% 막지는 못합니다. 법 집행도 마찬가지입니다. 이 시스템이 막는 것은 대량화·자동화된 공개 리셀 마켓 — 그게 실제 암표 문제의 본체입니다. 그리고 남는 개별 우회 경로에는 양도 1회 제한으로 규모의 경제를 제거했습니다."

### 7.3 기타 의존성·경계

| 항목 | 내용 | 입장 |
|---|---|---|
| USDC 중앙화 | Circle이 계정 동결 가능 | 인지된 트레이드오프. 법적 face value 매핑의 이점이 우위 |
| KRW 환산 | 법적 "구입가"가 원화 해석일 경우 USDC/KRW 변동으로 경계 사례 발생 가능 | 프로토콜은 동일 통화 내 비율로 강제. 환산 시점 문제는 법 해석 영역 |
| Registry 오라클 | 법률 → 파라미터 매핑은 사람이 수행 | §4.2 신뢰 경계에 명시 |
| 관할권 자가 신고 | 물리적 위치 검증 불가 | §4.2, 주최자 법적 책임 |

---

## 8. Development Sequence (D-14, 우선순위 재배치)

| 순위 | 항목 | 성격 |
|---|---|---|
| ① | 이벤트 생성 + 티켓 민팅(Token-2022, DefaultAccountState=Frozen) + 구매 플로우 | **필수** — thesis 기반 |
| ② | `execute_resale` 원자적 재판매 (thaw→검증→결제→전송→freeze) | **필수** — thesis 증명의 핵심 |
| ③ | Jurisdiction Registry PDA + `more_restrictive()` | **필수** — 데모 임팩트: "법 개정 tx 하나로 기존 이벤트 상한이 즉시 변경" 라이브 시연 |
| ④ | 지정 양도 (1회 제한 + 쿨다운 포함) | 높음 — §7.1 방어를 코드로 입증 |
| ⑤ | Bid queue (단일 FIFO) | 축소 가능 — 시간 부족 시 슬라이드 설명으로 대체해도 thesis 성립 |
| ⑥ | Check-in (상태 전이) | 낮음 — 반나절 작업, 마지막 |

핵심 판단: **②까지 돌아가면 "Transfer Hook은 가격을 볼 수 없지만 우리는 본다"가 증명된다.** ⑤는 데모 성립의 필요조건이 아님.

---

## 9. Tech Stack

- **온체인**: Rust, Anchor framework, Token-2022 (DefaultAccountState · MetadataPointer · TokenMetadata extensions)
- **프론트**: React, wallet-adapter, Anchor IDL 자동생성 TypeScript SDK
- **결제**: USDC (SPL)

*(v3 대비: Metaplex Core 제거 — §2.1, §6 참조)*