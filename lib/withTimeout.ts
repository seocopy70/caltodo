/**
 * 프로미스가 일정 시간 내에 끝나지 않으면 강제로 실패 처리한다.
 * Firestore 요청이 네트워크/보안 규칙 문제로 무한 대기 상태에 빠지는 것을 방지해서,
 * 버튼이 "저장 중..." 상태로 영원히 멈추는 일이 없도록 한다.
 *
 * 주의: 이 타임아웃은 실제 요청을 취소하지 않는다. Firestore 쓰기는 타임아웃 이후에도
 * 백그라운드에서 계속 진행되어 결국 성공할 수 있다. 그래서 기본값을 20초로 넉넉하게 두어
 * (특히 세션 첫 요청 시 연결 수립에 몇 초 걸리는 경우가 흔함) 정상적으로 끝날 요청을
 * 실패로 오판하는 일을 최소화한다.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 20000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err: any = new Error('요청이 지연되고 있습니다. 네트워크 상태를 확인해주세요. (이미 저장되었을 수 있으니 목록을 확인해보세요)');
      err.isTimeout = true;
      reject(err);
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
