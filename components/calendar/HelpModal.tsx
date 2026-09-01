'use client';

import { X } from 'lucide-react';
import { useModalBackClose } from '../../lib/useModalBackClose';

const SECTIONS = [
  {
    title: '📅 캘린더',
    items: [
      '월별보기: 날짜 숫자를 누르면 일별보기로, 일정을 누르면 수정창이 열려요. 그 외 빈 곳을 누르면 바로 새 일정을 만들 수 있어요.',
      '주별보기: 진입하면 06~20시가 먼저 보이고, 위아래로 스크롤하면 00~24시 전체를 볼 수 있어요. 날짜를 누르면 일별보기로 이동해요.',
      '일정을 새로 만들 때 "종일"을 체크하면 시간 없이 하루 종일 일정으로 등록돼요.',
      '반복 일정은 반복 횟수를 정할 수 있어요. 비워두면 계속 반복돼요.',
      '"기념일" 등록은 메뉴 → 기념일 관리에서 따로 할 수 있어요. 최초 연월일을 입력하면 매년 반복되고, 음력 기준 반복도 설정할 수 있어요.',
      '화면이 좁을 때는 일정표 영역 안에서 좌우로 밀어 전체 요일을 확인할 수 있고, 상단의 넓게보기 아이콘을 누르면 폰 넓은화면 기본 폭으로 볼 수도 있어요(이때는 일정표 안에서만 좌우로 움직이고 탭은 안 넘어가요).',
    ],
  },
  {
    title: '✅ 할일',
    items: [
      '할일 옆 빨/노/녹 색깔원으로 긴급도를 표시할 수 있어요 (빨강이 가장 급함). 입력창 아래쪽 색깔원을 누르면 그 자리에서 바로 저장돼요.',
      '할일에 처음 날짜를 설정하면 "일정으로도 저장할까요?"라고 물어봐요. "네"를 선택해야 캘린더에도 하루종일 일정으로 함께 나타나고, "다시 묻지 않기"로 다음부터 안 물어보게 할 수 있어요. 이 설정은 메인메뉴 → 할일-일정 연동 설정에서 언제든 다시 바꿀 수 있어요.',
      '할일 목록 상단에 실제로 만들어진 폴더가 아이콘(이름 포함)으로 보여요. 누르면 그 폴더 할일만 볼 수 있고, 맨 오른쪽 흰색 "전체" 아이콘을 누르면 전체보기로 돌아가요.',
      '목록 왼쪽의 점 6개 아이콘을 눌러서 위아래로 드래그하면 순서를 바꿀 수 있어요. 폴더 아이콘을 누르면 폴더만 바로 고를 수 있어요.',
      '오늘 탭의 할일 목록에는 완료된 항목이 보이지 않아요. 전체 할일 탭에서는 "완료됨"을 펼쳐서 볼 수 있어요.',
      '새 할일을 만들 때 "개인" 폴더가 있으면 기본으로 그 폴더에 담겨요.',
    ],
  },
  {
    title: '📝 메모',
    items: [
      '카드보기에서 메모를 누르면 바로 수정창이 열려요. 제목을 눌렀으면 제목에, 내용의 어느 지점을 눌렀으면 그 위치에 커서가 놓여요.',
      '메모 형식을 일반/체크리스트/번호매김 중에서 고를 수 있어요. 체크리스트에서 "항목 추가"를 누르면 새 항목이 맨 윗줄에 생겨요.',
      '메모에 폴더를 만들어서 분류할 수 있어요. 폴더를 만들거나 이름을 바꿀 때 색깔원(7가지 중 선택)도 함께 지정할 수 있고, 목록 상단에는 실제로 만들어진 폴더가 아이콘(이름 포함)으로 보여서 눌러 바로 필터링할 수 있어요. 맨 오른쪽 흰색 "전체" 아이콘을 누르면 전체보기로 돌아가요.',
      '새 메모를 만들 때 "개인" 폴더가 있으면 기본으로 그 폴더에 담겨요.',
      '메모탭 폴더 아이콘을 눌러 폴더 하나를 "보안폴더"로 지정할 수 있어요. PIN 번호를 입력해야 볼 수 있고, 5회 이상 틀리면 잠기는데 이땐 로그인 이메일로 인증코드를 받아 새로 설정할 수 있어요. 보안폴더 메모는 전체 목록·검색·오늘 탭에 나타나지 않아요.',
      '별표를 누르면 오늘 탭에도 그 메모가 카드로 보이고, 눌러서 바로 내용에 커서가 놓인 수정창을 열 수 있어요.',
      '삭제된 메모는 보관함에서 복원하거나 완전히 지울 수 있어요.',
    ],
  },
  {
    title: '💾 백업',
    items: [
      '메뉴 → 가져오기/내보내기에서 전체 데이터를 JSON 파일로 백업할 수 있어요.',
      '메뉴 → 이메일 백업에서 로그인한 구글 이메일로 백업 파일을 바로 받을 수 있고, 매일/매주/매월 자동 발송도 설정할 수 있어요.',
      '기기를 바꾸면 같은 구글 계정으로 로그인한 뒤, 백업 파일을 다시 가져오면 그대로 복원돼요.',
    ],
  },
  {
    title: '🔎 기타',
    items: [
      '일정표 바깥에서 화면을 좌우로 밀면 오늘·월·주·할일·메모 탭을 순서대로 넘길 수 있어요.',
      '검색창에 입력하면 일정·할일·메모를 한 번에 찾을 수 있어요. 화면이 좁을 때는 검색창이 탭 아래에 나타나요.',
      '메뉴 → 일정데이터 관리에서 특정 기간이나 검색 결과에 해당하는 일정을 한꺼번에 정리할 수 있어요.',
      '뒤로가기를 눌러도 앱이 바로 꺼지지 않도록 되어 있어요. 열려있는 창/메뉴가 있으면 그것부터 닫히고, 아무것도 없을 때는 한 번 더 눌러야 종료돼요.',
    ],
  },
];

export default function HelpModal({ onClose }: any) {
  useModalBackClose(onClose);
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h3 className="font-black text-xl text-slate-900 dark:text-white">도움말</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="font-bold text-base mb-2 text-slate-900 dark:text-white">{section.title}</h4>
              <ul className="space-y-1.5">
                {section.items.map((item, i) => <li key={i} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex gap-2"><span className="text-blue-500 dark:text-blue-400 shrink-0">•</span>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
