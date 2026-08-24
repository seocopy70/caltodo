'use client';

import { X } from 'lucide-react';

const SECTIONS = [
  {
    title: '📅 캘린더',
    items: [
      '월별보기: 날짜를 누르면 일정이 있으면 그날 일정을 보여주고, 없으면 바로 새 일정을 만들 수 있어요.',
      '주별보기: 시간표에서 원하는 시간칸을 누르면 그 시간으로 바로 일정을 만들 수 있어요.',
      '일정을 새로 만들 때 "종일"을 체크하면 시간 없이 하루 종일 일정으로 등록돼요.',
    ],
  },
  {
    title: '✅ 할일',
    items: [
      '할일 옆 빨/노/녹 색깔원으로 긴급도를 표시할 수 있어요 (빨강이 가장 급함).',
      '날짜를 설정한 할일은 캘린더에도 자동으로 함께 나타나요. 한쪽에서 날짜를 바꾸면 다른 쪽도 같이 바뀝니다.',
      '목록 왼쪽의 점 6개 아이콘을 눌러서 위아래로 드래그하면 순서를 바꿀 수 있어요.',
    ],
  },
  {
    title: '📝 메모',
    items: [
      '메모를 누르면 전체 내용을 크게 볼 수 있고, 그 안을 한 번 더 누르면 수정할 수 있어요.',
      '별표를 누르면 오늘 탭에도 그 메모가 보여요.',
      '삭제된 메모는 보관함에서 복원하거나 완전히 지울 수 있어요.',
    ],
  },
  {
    title: '💾 백업',
    items: [
      '메뉴 → 가져오기/내보내기에서 전체 데이터를 JSON 파일로 백업할 수 있어요.',
      '기기를 바꾸면 같은 구글 계정으로 로그인한 뒤, 백업 파일을 다시 가져오면 그대로 복원돼요.',
    ],
  },
  {
    title: '🔎 기타',
    items: [
      '화면을 좌우로 밀면 오늘·월·주·할일·메모 탭을 순서대로 넘길 수 있어요.',
      '검색창에 입력하면 일정·할일·메모를 한 번에 찾을 수 있어요.',
    ],
  },
];

export default function HelpModal({ onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <h3 className="font-black text-xl text-white">도움말</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full"><X /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="font-bold text-base mb-2">{section.title}</h4>
              <ul className="space-y-1.5">
                {section.items.map((item, i) => <li key={i} className="text-sm text-slate-300 leading-relaxed flex gap-2"><span className="text-blue-400 shrink-0">•</span>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
