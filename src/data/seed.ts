import { uid } from '../utils/uid'
import { defaultCardPosition } from '../utils/layout'
import type { Campaign, Channel, Client, FunnelNode, LineStyle, Stage, Status } from '../types'

export const STAGE_PALETTE = [
  'oklch(0.56 0.14 150)',
  'oklch(0.56 0.14 240)',
  'oklch(0.56 0.14 295)',
  'oklch(0.56 0.14 190)',
  'oklch(0.58 0.15 10)',
  'oklch(0.56 0.14 340)',
]

interface CampaignSeed {
  name: string
  channel: Channel
  status: Status
  pos: 'top' | 'bottom'
  sent: number
  o: number
  c: number
  v: number
  period: string
  delivery: string
  trigger: string
  audience: string
  convEvent: string
  cap: string
  link: string
}

function campaign(seedData: CampaignSeed, indexInZone: number): Campaign {
  const { x, y } = defaultCardPosition(seedData.pos, indexInZone)
  return {
    id: uid(),
    name: seedData.name,
    channel: seedData.channel,
    status: seedData.status,
    pos: seedData.pos,
    x,
    y,
    sent: seedData.sent,
    opens: Math.round(seedData.sent * seedData.o),
    clicks: Math.round(seedData.sent * seedData.c),
    convs: Math.round(seedData.sent * seedData.v),
    rate: { o: seedData.o, c: seedData.c, v: seedData.v },
    period: seedData.period,
    delivery: seedData.delivery,
    trigger: seedData.trigger,
    audience: seedData.audience,
    convEvent: seedData.convEvent,
    cap: seedData.cap,
    link: seedData.link,
  }
}

function node(label: string, sub: string, line: LineStyle, campaigns: CampaignSeed[]): FunnelNode {
  const zoneCounts: Record<'top' | 'bottom', number> = { top: 0, bottom: 0 }
  return {
    id: uid(),
    label,
    sub,
    line,
    campaigns: campaigns.map((c) => campaign(c, zoneCounts[c.pos]++)),
  }
}

function stage(name: string, colorIndex: number, nodes: FunnelNode[]): Stage {
  return { id: uid(), name, color: STAGE_PALETTE[colorIndex % STAGE_PALETTE.length], nodes }
}

export function seed(): Client[] {
  const homeniq: Client = {
    id: uid(),
    name: '홈닉',
    stages: [
      stage('획득', 0, [
        node('앱 설치', 'app_install', 'solid', [
          {
            name: '설치 후 가입 유도 푸시',
            channel: 'Push',
            status: 'alwayson',
            pos: 'top',
            sent: 48210,
            o: 0.31,
            c: 0.09,
            v: 0.042,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '설치 후 24시간 내 미가입',
            audience: '설치 후 24시간 내 미가입',
            convEvent: 'sign_up',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
        node('회원가입', 'sign_up', 'solid', [
          {
            name: '가입 미완료 리마인드',
            channel: 'SMS',
            status: 'stopped',
            pos: 'top',
            sent: 9320,
            o: 0.41,
            c: 0.07,
            v: 0.03,
            period: '09.15–',
            delivery: 'Scheduled',
            trigger: '가입 시작 후 이탈',
            audience: '가입 시작 후 이탈',
            convEvent: 'verify_complex',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
          {
            name: '가입 웰컴 메시지 D+0',
            channel: 'Kakao',
            status: 'alwayson',
            pos: 'bottom',
            sent: 21840,
            o: 0.62,
            c: 0.18,
            v: 0.11,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '신규 가입자',
            audience: '신규 가입자',
            convEvent: 'verify_complex',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('활성화', 1, [
        node('단지 인증', 'verify_complex', 'solid', [
          {
            name: '단지 인증 리마인드 D+1·D+3',
            channel: 'Push',
            status: 'alwayson',
            pos: 'top',
            sent: 15402,
            o: 0.28,
            c: 0.12,
            v: 0.064,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '가입 후 단지 미인증',
            audience: '가입 후 단지 미인증',
            convEvent: 'first_service',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
          {
            name: '인증 혜택 안내 인앱',
            channel: 'In-app',
            status: 'experiment',
            pos: 'bottom',
            sent: 0,
            o: 0.3,
            c: 0.1,
            v: 0.05,
            period: '10.14 시작',
            delivery: 'Scheduled',
            trigger: '10.14 09:00 1회',
            audience: '단지 인증 완료 유저',
            convEvent: 'first_service',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
        node('첫 서비스 이용', 'first_service', 'solid', [
          {
            name: '첫 이용 가이드 이메일',
            channel: 'Email',
            status: 'alwayson',
            pos: 'bottom',
            sent: 11203,
            o: 0.24,
            c: 0.05,
            v: 0.021,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '인증 후 서비스 미이용',
            audience: '인증 후 서비스 미이용',
            convEvent: 'autopay_register',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('전환', 2, [
        node('관리비 자동납부 등록', 'autopay_register', 'solid', [
          {
            name: '자동납부 등록 혜택 안내',
            channel: 'Kakao',
            status: 'alwayson',
            pos: 'top',
            sent: 8840,
            o: 0.55,
            c: 0.14,
            v: 0.087,
            period: '10.01–10.31',
            delivery: 'Scheduled',
            trigger: '매월 고지일 10:00',
            audience: '관리비 고지 수신 · 자동납부 미등록',
            convEvent: 'facility_booking',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
          {
            name: '관리비 고지 연계 푸시',
            channel: 'Push',
            status: 'stopped',
            pos: 'bottom',
            sent: 30110,
            o: 0.33,
            c: 0.11,
            v: 0.052,
            period: '09.01–09.30',
            delivery: 'Scheduled',
            trigger: '매월 고지일 10:00',
            audience: '관리비 고지 수신 유저',
            convEvent: 'facility_booking',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
        node('커뮤니티 시설 예약', 'facility_booking', 'dashed', [
          {
            name: '피트니스 예약 오픈 알림',
            channel: 'Push',
            status: 'experiment',
            pos: 'top',
            sent: 0,
            o: 0.3,
            c: 0.1,
            v: 0.05,
            period: '10.20 시작',
            delivery: 'Scheduled',
            trigger: '10.20 09:00 1회',
            audience: '피트니스 보유 단지 거주자',
            convEvent: 'monthly_active',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('유지', 3, [
        node('월간 재방문', 'monthly_active', 'solid', [
          {
            name: '월간 단지 소식 뉴스레터',
            channel: 'Email',
            status: 'alwayson',
            pos: 'bottom',
            sent: 40220,
            o: 0.21,
            c: 0.04,
            v: 0.015,
            period: '매월 1일',
            delivery: 'Scheduled',
            trigger: '매월 1일 10:00',
            audience: '전체 인증 유저',
            convEvent: 'dormant_30d',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('복귀', 4, [
        node('휴면 30일', 'dormant_30d', 'dotted', [
          {
            name: '휴면 복귀 쿠폰',
            channel: 'Kakao',
            status: 'alwayson',
            pos: 'top',
            sent: 6120,
            o: 0.48,
            c: 0.1,
            v: 0.038,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '30일 미접속',
            audience: '30일 미접속',
            convEvent: '',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
          {
            name: '재방문 인앱 서베이',
            channel: 'In-app',
            status: 'stopped',
            pos: 'bottom',
            sent: 2210,
            o: 0.6,
            c: 0.2,
            v: 0.05,
            period: '09.20–',
            delivery: 'Scheduled',
            trigger: '휴면 후 복귀',
            audience: '휴면 후 복귀 유저',
            convEvent: '',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
    ],
  }

  const commerce: Client = {
    id: uid(),
    name: '샘플 커머스',
    stages: [
      stage('유입', 0, [
        node('첫 방문', 'first_visit', 'solid', [
          {
            name: '첫 방문 웰컴 쿠폰',
            channel: 'In-app',
            status: 'alwayson',
            pos: 'top',
            sent: 52300,
            o: 0.7,
            c: 0.22,
            v: 0.06,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '첫 방문',
            audience: '첫 방문',
            convEvent: 'view_item',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('탐색', 1, [
        node('상품 상세 조회', 'view_item', 'solid', []),
        node('장바구니 담기', 'add_to_cart', 'solid', [
          {
            name: '찜 상품 가격 인하 알림',
            channel: 'Push',
            status: 'alwayson',
            pos: 'bottom',
            sent: 18400,
            o: 0.35,
            c: 0.14,
            v: 0.07,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '찜 상품 가격 인하',
            audience: '찜 상품 가격 인하',
            convEvent: 'first_purchase',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('구매', 2, [
        node('첫 구매', 'first_purchase', 'solid', [
          {
            name: '첫 구매 감사 + 리뷰 요청',
            channel: 'Kakao',
            status: 'alwayson',
            pos: 'top',
            sent: 7200,
            o: 0.58,
            c: 0.2,
            v: 0.09,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '첫 구매 완료',
            audience: '첫 구매 완료',
            convEvent: 'second_purchase',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('재구매', 3, [
        node('2회 구매', 'second_purchase', 'solid', [
          {
            name: 'D+14 재구매 쿠폰',
            channel: 'SMS',
            status: 'experiment',
            pos: 'bottom',
            sent: 0,
            o: 0.4,
            c: 0.1,
            v: 0.05,
            period: '10.10 시작',
            delivery: 'Scheduled',
            trigger: '첫 구매 후 14일',
            audience: '첫 구매 후 14일 미재구매',
            convEvent: 'vip_tier',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
        node('VIP', 'vip_tier', 'dashed', []),
      ]),
      stage('이탈', 4, [
        node('장바구니 이탈', 'cart_abandon', 'dotted', [
          {
            name: '장바구니 이탈 리마인드 1h',
            channel: 'Push',
            status: 'alwayson',
            pos: 'top',
            sent: 12900,
            o: 0.3,
            c: 0.12,
            v: 0.08,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '장바구니 담고 1시간 미구매',
            audience: '장바구니 담고 1시간 미구매',
            convEvent: 'first_purchase',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
          {
            name: '이탈 고객 이메일 D+1',
            channel: 'Email',
            status: 'stopped',
            pos: 'bottom',
            sent: 8800,
            o: 0.22,
            c: 0.06,
            v: 0.03,
            period: '08.01–09.30',
            delivery: 'Scheduled',
            trigger: '이탈 후 1일',
            audience: '이탈 고객',
            convEvent: 'first_purchase',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
    ],
  }

  return [homeniq, commerce]
}
