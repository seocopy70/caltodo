/**
 * 프로미스가 일정 시간 내에 끝나지 않으면 강제로 실패 처리한다.
 * Firestore 요청이 네트워크/보안 규칙 문제로 무한 대기 상태에 빠지는 것을 방지해서,
 * 버튼이 "저장 중..." 상태로 영원히 멈추는 일이 없도록 한다.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`요청 시간이 초과되었습니다 (${ms / 1000}초). 네트워크 상태 또는 Firestore 보안 규칙을 확인해주세요.`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
