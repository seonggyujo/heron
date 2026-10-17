# Heron 구조

한 파일은 한 가지 기능만 맡는다. 파일이 약 150줄을 넘으면 기능 단위로 쪼갠다.
계산 로직(그리드 배치, 배치 flush 규칙 등)은 DOM, Tauri API와 분리해서 순수 함수로 둔다.

터미널 안쪽은 꾸미지 않는다. xterm 기본 색, Cascadia Mono 글꼴, 셸이 출력한 바이트만 그린다.
예외는 터미널 속 왜가리(설정에서 pane마다 0~3마리) 하나다. 에이전트가 있는 pane의 빈 칸 위 캔버스에만 덧그리고, 터미널 내용은 바꾸지 않는다.
테마(기본 블랙, 초록)와 상태 표시는 앱 틀(타이틀바, pane 테두리와 헤더)에만 둔다.

## 프론트엔드 `src/`

| 경로 | 역할 |
| --- | --- |
| `main.ts` | 부트스트랩만. 모듈을 만들고 서로 연결한다. 새 pane(+ 버튼, 빈 화면, Ctrl+Shift+T)은 Heron을 연 폴더("Open in Heron")에서, 없으면 home에서 |
| `wire-agents.ts` | `main.ts`처럼 연결만: 에이전트 소식과 pane 신호를 에이전트 보드에 넣고, 보드가 바뀌면 에이전트가 있는 pane의 줄(번호, 폴더, 경로, 에이전트, 커밋하지 않은 변경량)을 만들어 사이드바, 하단바, pane 점(`pane-signals.ts`의 표시 함수)을 다시 그린다. 폴더 이름은 worktree면 "저장소 · 이름". 변경량은 `wire-changes.ts`가 git에 묻는다. 에이전트가 나를 기다리거나 끝나면 작업 표시줄 버튼을 깜빡인다(`ipc/attention.ts`). 사이드바 줄에 마우스를 올리면 그 pane 테두리를 밝힌다. 사이드바에 "새 에이전트"(`wire-new-agent.ts`)와 최근 세션(`wire-sessions.ts`)을 넣고, pane에서 돌고 있는 세션 id를 알려 주고, pty별 세션 id를 `wire-workspace.ts`에 준다. 시작할 때 Claude Code 훅 상태를 맞춘다(`app/agent-hooks.ts`) |
| `wire-new-agent.ts` | 연결만: 사이드바 맨 위 "새 에이전트". 기본 셸로 pane을 열고 첫 프롬프트에 `claude`를 친다. 버튼은 선택된 pane의 폴더에서, ▾ 메뉴는 최근 세션의 폴더(`agent/start-folders.ts`), git 저장소면 `claude --worktree`, 폴더 선택 창(`ipc/folders.ts`) |
| `wire-sessions.ts` | 연결만: 사이드바의 최근 세션. 누르면 기본 셸로 마지막으로 돌던 폴더에 pane을 열고 `claude --resume <id>`를 친다(`app/claude-commands.ts`, id는 UUID 모양만). 세션 삭제(휴지통). 목록은 창이 포커스를 받을 때와 pane에서 세션이 끝날 때 다시 읽고(백엔드는 바뀐 파일만 읽는다), 달라졌을 때만 다시 그린다. pane에서 돌고 있는 세션은 뺀다. 읽은 목록은 새 에이전트 메뉴가 쓴다 |
| `wire-changes.ts` | 에이전트 폴더가 마지막 커밋에서 얼마나 바뀌었는지 git에 묻고(`ipc/folders.ts`) 답을 보관한다. 에이전트 상태가 바뀔 때, 창이 포커스를 받을 때(10초 안에 물었으면 건너뜀), 작업 중이면 15초마다 다시 묻고, 답이 달라지면 다시 그리게 한다 |
| `wire-workspace.ts` | 연결만: 지난 작업. 시작할 때(설정 > 지난 작업 다시 열기) 저장된 pane을 셸과 폴더 그대로 모두 놓고 사용자 배치를 되살린 다음, 셸을 한꺼번에 띄운다(셸마다 처음부터 제 크기로). Claude Code가 돌던 pane은 그 세션을 이어 열고, 이어 열 수 없으면(메시지가 없어 저장되지 않았거나 다른 곳에서 실행 중) 새 `claude`를 연다. 그다음 "Open in Heron" 폴더, 아무것도 없으면 home에 pane 하나. 실행 중에는 시계가 돌 때마다 지금 상태를 저장한다(바뀐 때만) |
| `agent/agent-model.ts` | 순수 함수: pane 하나의 에이전트(`Agent`)와 그 상태(쉬는 중, 작업 중, 권한 필요, 질문, 입력 대기, 끝남), 작업 폴더, 세션 id(최근 세션에서 빼려고), 급한 순서, 상태별 색. 상태를 정하는 신호: Heron 훅이 쓴 상태(정확), 터미널 제목(`✳`은 쉬는 중, `◐◑`는 작업 중. 아무것도 설치하지 않아도 동작), pane의 키 입력과 포커스. 그 밖의 소식은 `agent-reports.ts`가 붙인다. 훅이 한 번 보고하면 훅이 상태를 정한다. 단 Esc나 Ctrl+C는 작업을 멈춘 것으로 본다(Claude Code는 중단된 턴에 Stop 훅을 보내지 않는다). 작업 표시줄을 깜빡일 변화인지도 여기서 정한다 |
| `agent/agent-reports.ts` | 순수 함수: 백엔드와 플러그인의 소식을 에이전트에 붙인다. heron-limits 플러그인의 컨텍스트 사용률, 실행 중인 서브에이전트, 백엔드의 모델 확인, 활동(`activity.ts`), 토큰(`tokens.ts`) |
| `agent/usage.ts` | 순수 함수: heron-limits 플러그인의 상태 파일에서 계정의 사용 한도(5시간, 주간)와 컨텍스트 사용률, 막대 색(70%부터 노랑, 90%부터 빨강). 한도가 하나도 없는 상태 파일(새 세션의 첫 응답 전)은 한도로 치지 않아서 마지막 한도가 화면에 남는다. 쓴 시각만 다른 한도는 같은 것으로 본다 |
| `agent/subagents.ts` | 순수 함수: 백엔드가 보낸 실행 중인 서브에이전트 목록(id, 종류, 시작 시각) |
| `agent/activity.ts` | 순수 함수: 백엔드가 기록 파일에서 읽은 활동(지금 단계: 생각, 답 쓰기, 도구와 그 대상. 이번 턴의 도구 호출) 검사, 도구 종류(읽기, 찾기, 수정, 실행, 웹, 서브에이전트, 그 밖), 지금 하는 일(사이드바 색과 왜가리 몸짓이 쓴다) |
| `agent/tokens.ts` | 순수 함수: 백엔드가 기록 파일에서 센 토큰(세션 전체와 이번 턴, 입력, 출력, 캐시 쓰기, 캐시 읽기) 검사, 합계, 짧은 표시("12.3k", "1.24M") |
| `agent/model-label.ts` | 순수 함수: 모델 id를 사이드바용 이름으로("claude-opus-5-5" → "Opus 5.5", `[1m]`은 "1M") |
| `agent/start-folders.ts` | 순수 함수: 새 에이전트 메뉴의 폴더. 선택된 pane의 폴더, 그다음 최근 세션의 폴더를 최신부터 한 번씩, 최대 8개. Claude Code가 만든 worktree는 뺀다 |
| `agent/session-groups.ts` | 순수 함수: 최근 세션을 마지막으로 돌던 폴더별로 묶는다. 가장 최근 세션이 오래된 폴더가 위, 최신 폴더가 아래이고 폴더 안도 같은 순서. 대소문자와 끝의 `\`만 다른 폴더는 하나로 본다(접은 폴더를 기억하는 열쇠) |
| `agent/agent-board.ts` | pty별 에이전트와 가장 최근 한도를 보관. 모든 신호를 `agent-model.ts`, `agent-reports.ts`, `usage.ts`로 계산하고, 바뀌면 구독자에게 어느 pane이 어떤 상태에서 어떤 상태로 바뀌었는지 알린다. 백엔드는 모델 확인, 서브에이전트, 활동, 토큰을 바뀔 때만 보내므로 pane별 마지막 값을 기억했다가 그 pane에 새로 생긴 에이전트에 붙인다(pane이 닫히면 지운다). 플러그인 상태 파일이 한 번이라도 왔는지도 안다. 같은 제목이나 같은 컨텍스트 사용률이 다시 오면 에이전트를 그대로 두어서, 구독자는 실제로 바뀔 때만 다시 그린다 |
| `app/paths.ts` | 경로에서 마지막 폴더 이름, `claude --worktree`가 만든 폴더인지, 보여 줄 이름(worktree면 "heron · fix-login") |
| `app/unchecked.ts` | 순수 함수: 밖에서 온 값(백엔드 이벤트, 플러그인 파일, 저장한 상태)을 모양을 확인하기 전에 읽기. 객체의 필드, 빈 문자열이 아닌 글자, 유한한 숫자. 나머지는 빈 값 |
| `app/dom.ts` | 화면 모듈(`ui/`, `pane/`)이 함께 쓰는 작은 DOM 도우미(`span`) |
| `app/claude-commands.ts` | pane 셸에 칠 Claude Code 명령: 새 세션(`--worktree` 포함), 이어 열기(UUID 모양 id만) |
| `app/workspace.ts` | 순수 함수: 저장한 지난 작업의 모양(pane마다 셸, 폴더, 세션 id와 사용자 배치)과 읽어 온 값 검사. 모르는 셸은 기본 셸로, UUID가 아닌 세션은 버린다 |
| `app/workspace-store.ts` | 지난 작업을 localStorage(`heron.workspace`)에 읽고 쓰기. 설정 초기화로 지워져도 다음 저장 때 다시 쓴다 |
| `app/perf-monitor.ts` | dev 전용 long task(50ms 초과) 로그 |
| `app/theme.ts` | 앱 틀 테마(black 기본, green) 적용과 저장(`prefs.ts`의 `pref()`) |
| `app/log.ts` | 범위별 로거. dev에서는 콘솔과 `tauri dev` 터미널로, prod에서는 warn/error만 콘솔로 |
| `app/shells.ts` | 셸 표시 이름, + 버튼 기본 셸 저장(`pref()`). 저장한 셸이 없어졌으면 처음 찾은 셸 |
| `app/font-size.ts` | 터미널 글씨 크기(10~24px) 저장(`pref()`) |
| `app/uptime-clock.ts` | 앱 전체에 1초 `setInterval` 1개. 창이 숨거나 최소화되면 멈춘다. 가끔만 째깍여야 하는 곳(일하는 에이전트가 있을 때, 한도가 보일 때)은 `switchFor`로 구독을 켜고 끈다 |
| `app/durations.ts` | 순수 함수: 경과 시간("3m 07s")과 남은 시간("2h 13m")을 짧은 글로 |
| `app/prefs.ts` | 작은 설정값 저장(`pref()`, 값마다 `heron.*` 키 하나): 설정 창(애니메이션, 터미널 속 왜가리 수, exit 0이면 닫기, 지난 작업 다시 열기)과 화면이 스스로 기억하는 것(사이드바 접힘, 안내 숨김, 접은 세션 폴더), Claude Code 훅을 켰는지(초기화해도 메모리에는 남는다). 테마, 글씨 크기, 기본 셸도 각 모듈이 `pref()`로 만든다. 만든 값은 모두 초기화 목록에 저절로 들어간다. 언어는 `i18n/lang.ts`가 따로 저장한다(`i18n/`은 앱 모듈을 import하지 않는다). 실패하면 기본값 |
| `app/agent-hooks.ts` | Heron의 Claude Code 훅이 켜졌는지(사이드바와 설정이 함께 본다), 켜고 끄기. 켠 선택을 기억해서, 시작할 때 업데이트로 빠졌거나 다른 heron.exe를 가리키는 훅을 다시 넣는다 |
| `app/motion.ts` | 설정 > Animations. 끄면 `<html class="no-motion">`으로 CSS 전환·애니메이션을 멈추고, pane 등장·FLIP·출력 글로우와 터미널 속 왜가리도 끈다. pane 움직임이 함께 쓰는 ease-out 곡선(`EASE_OUT`) |
| `app/reset.ts` | 설정 > Reset: 저장된 `heron.*` 값을 모두 지우고 `pref()` 값을 기본값으로. 화면 적용은 `main.ts`가 한다 |
| `app/visibility.ts` | 창 숨김·최소화 감지(WebView2는 최소화해도 `document.hidden`이 false라 Tauri 창 상태도 본다), `app-hidden` class, 애니메이션 허용 여부 |
| `ui/titlebar.ts` | macOS식 타이틀바. 왼쪽 로고, 오른쪽 action 슬롯과 신호등(Windows 순서). 비활성 표시는 Tauri 창 포커스 이벤트로. 빈 곳을 우클릭하면 창의 시스템 메뉴(`ipc/window-menu.ts`) |
| `ui/new-terminal-button.ts` | [+ 새 터미널 (선택된 셸)][▾] split 버튼. + 를 눌러야 생성 |
| `ui/shell-menu.ts` | 설치된 셸 목록 드롭다운. 고르면 선택만 하고 기억한다(생성은 + 버튼). ↑/↓로 강조를 옮기고 Enter로 고른다 |
| `ui/popover.ts` | 버튼 아래 패널 열고 닫기(바깥 클릭, Esc, 창 blur). 타이틀바는 오른쪽 끝, 사이드바는 왼쪽 끝을 맞춘다. 열려 있는 동안 키를 터미널보다 먼저 받아서(capture) Esc와 패널이 쓰는 키가 셸로 가지 않는다 |
| `ui/shortcuts.ts` | 앱 단축키(heron-c와 같다): Ctrl+Shift+T 새 pane, Ctrl+Tab/Ctrl+Shift+Tab 다음/이전 pane(연 순서), Alt+Space 창의 시스템 메뉴. 터미널보다 먼저 받는다 |
| `ui/keep-pane-focus.ts` | 앱의 버튼을 마우스로 눌러도 키보드는 선택된 pane에 남는다(heron-c와 같다). 버튼은 클릭을 받고, Tab 키로는 여전히 버튼에 갈 수 있다 |
| `ui/settings-panel.ts` | 톱니 버튼과 설정 창. 열 때마다, Reset 뒤에, 열린 채 언어가 바뀌면 행을 다시 만든다 |
| `ui/settings-rows.ts` | 설정 행: 테마, 언어, 글씨 크기, 애니메이션, 터미널 속 왜가리(끔, 1, 2, 3), exit 0이면 닫기, 지난 작업 다시 열기, Claude Code 훅(못 바꾸면 이유를 아래에), 설정 Reset. 저장된 값으로 만들고, 바꾸면 로그 |
| `ui/lang-toggle.ts` | 언어 선택 버튼 두 개(English, 한국어, `radio-group.ts`). 언어 이름은 그 언어로 적어 어느 언어에서든 찾을 수 있다 |
| `ui/radio-group.ts` | 설정 창의 라디오 버튼 묶음: 하나가 선택되고, 다른 것을 누르면 바꾸고 알린다. 버튼 모양은 선택지마다 정한다(언어, 테마, 터미널 속 왜가리가 쓴다) |
| `ui/heron-count-toggle.ts` | 설정 > 터미널 속 왜가리: 끔, 1, 2, 3 버튼 묶음(`radio-group.ts`) |
| `ui/confirm-button.ts` | 되돌릴 수 없는 동작용 버튼: 첫 클릭은 "Sure?"(정말요?), 3초 안에 다시 누르면 실행하고 결과를 잠깐 보인다 |
| `ui/switch.ts` | 설정 창 켜기/끄기 스위치. 바꾸는 일이 실패할 수 있으면(Promise) 기다렸다가 실제 상태를 보여 준다 |
| `ui/font-size-control.ts` | `A−` `A+` 버튼(설정 창 안) |
| `ui/terminal-count.ts` | 실행 중 터미널 개수 |
| `ui/tidy-button.ts` | 자동 격자로 되돌리는 버튼. 수동 배치일 때만 보이고, action 맨 왼쪽이라 나타나도 다른 버튼 위치가 안 바뀐다 |
| `ui/theme-toggle.ts` | 테마 선택 동그라미 두 개(블랙, 초록. 설정 창 안, `radio-group.ts`) |
| `ui/empty-state.ts` | 터미널 0개일 때 큰 + 버튼과 깜빡이는 `_` |
| `ui/agent-sidebar.ts` | 왼쪽 사이드바, 늘 보인다: 맨 위 "새 에이전트" 버튼, 에이전트가 있는 pane을 급한 순(나를 기다림, 끝남, 작업 중, 쉬는 중)으로(없으면 없다는 한 줄), 최근 세션, 맨 아래에 안내(`agent-hints.ts`). 버튼과 최근 세션은 `wire-sessions.ts`가 만들어 넘긴다. 번호 배지만 남게 접을 수 있고 기억한다. 줄은 보드가 바뀔 때만 새로 만들고, 1초 갱신은 경과 시간만 바꾼다 |
| `ui/agent-hints.ts` | 사이드바 맨 아래 안내: 먼저 Heron의 Claude Code 훅 켜기 제안(못 켜면 이유), 훅이 켜지거나 제안을 닫으면 heron-limits 플러그인 안내. 각각 × 로 영영 닫는다 |
| `ui/agent-item.ts` | 사이드바 한 줄: 상태 색 배지에 든 pane 번호, 폴더, 세션의 모델(`/model`로 바꾸면 다음 폴링에 따라 바뀐다), 경과 시간, 상태(권한 요청과 질문이면 무엇인지도. 작업 중이면 지금 하는 일), 이번 턴의 도구 블록, 토큰, 커밋하지 않은 줄 수(+12 −3), 모델 경고, 실행 중인 서브에이전트. 누르면 그 pane으로, 마우스를 올리면 그 pane 강조 |
| `ui/agent-activity.ts` | 사이드바 줄의 활동: 작업 중이면 상태 대신 "main.ts 고치는 중"처럼 지금 하는 일(앞의 점은 종류 색), 그 아래 이번 턴의 도구를 종류 색 블록으로(실행 중인 것은 테두리), 툴팁에 최근 도구 |
| `ui/agent-tokens.ts` | 사이드바 줄의 토큰: "토큰 1.24M · 이번 턴 38.2k", 툴팁에 세션과 이번 턴의 종류별 토큰 |
| `ui/subagent-lines.ts` | 사이드바 줄 아래의 서브에이전트: "↳ 종류 실행 시간", 오래된 것부터 셋까지, 나머지는 "외 N개" |
| `ui/new-agent-button.ts` | 사이드바 맨 위 split 버튼: "+ 새 에이전트"는 선택된 pane의 폴더 이름을 보여 주고 그 폴더의 새 pane에서 Claude Code를 시작, ▾는 폴더 메뉴. 접으면 "+"만 |
| `ui/agent-folder-menu.ts` | 새 에이전트의 폴더 메뉴: 폴더마다 이름과 경로, 누르면 거기서 시작. git 저장소면 "worktree"(새 worktree와 브랜치에서 시작. 열 때 git 저장소인지 물어서 보인다), 맨 아래 "폴더 선택…" |
| `ui/recent-sessions.ts` | 사이드바의 최근 세션: 폴더별로 묶고(`agent/session-groups.ts`), 위가 오래된 것, 아래가 최신이고 처음엔 최신이 보인다. 폴더는 머리를 눌러 접고 펴며, 접은 폴더는 기억한다. 스크롤바 없이 휠로 움직이고, 가려진 쪽 가장자리를 흐리게 해서 "↑ 3개 더"처럼 센다. 접으면 숨는다 |
| `ui/recent-group-head.ts` | 최근 세션의 폴더 머리: 화살표, 폴더 이름(worktree면 "저장소 · 이름"), 세션 수, 가장 최근 시각. 누르면 접고 편다 |
| `ui/recent-session-row.ts` | 최근 세션 한 줄(폴더 머리 아래): 제목과 얼마 전. 마우스를 올리면 시간 대신 "이어 열기", 누르면 연다. 오른쪽 클릭하면 줄 위에 "삭제할까요? [삭제] [취소]"(휴지통으로)(Esc나 바깥 클릭은 취소), 실패하면 잠깐 이유를 보인다 |
| `ui/usage-bar.ts` | 창 아래 하단바(heron-limits 플러그인): 한도 블록 두 개와 에이전트마다 컨텍스트 사용률 칩(pane 순서, 누르면 그 pane으로). 한도도 컨텍스트도 없으면 숨고, 한도가 있을 때만 1초 시계를 구독한다 |
| `ui/limit-meter.ts` | 하단바의 한도 하나(5시간, 주간): 이름, 초기화까지 남은 시간, 큰 사용률 숫자와 막대. 70%부터 노랑, 90%부터 빨강 |
| `i18n/en.ts` | 화면에 보이는 모든 글자의 영어 표와 그 키 타입(`Strings`). 셸 이름과 로그는 번역하지 않는다 |
| `i18n/ko.ts` | 같은 키의 한국어 표 |
| `i18n/hooks-error.ts` | Claude Code 훅 명령의 오류 코드를 문장으로 |
| `i18n/lang.ts` | 현재 언어와 `t()`. 저장된 선택이 없으면 Windows 표시 언어를 따른다. 화면 모듈은 `onLangChange`로 글자를 다시 쓴다 |
| `i18n/time-ago.ts` | 얼마 전인지 앱 언어로("방금", "5분 전", "어제"). `Intl.RelativeTimeFormat`, 단위는 내림 |
| `ipc/launch.ts` | 시작 폴더 받기(`take_launch_dir`), 켜진 창으로 온 폴더(`open-folder` 이벤트) |
| `ipc/pty.ts` | PTY 명령 타입 래퍼, 출력 Channel(ArrayBuffer), `pty-exit` 구독, 셸 목록 |
| `ipc/agent.ts` | `agent-update` 이벤트 구독. 종류는 `state`(Heron 훅), `subagents`(Heron 훅, 실행 중인 서브에이전트), `check`(백엔드의 모델 확인), `activity`(백엔드가 기록 파일에서 읽은 활동), `status`(heron-limits 플러그인). JSON을 검사 없이 넘기고, 검사는 `agent-model.ts`, `agent-reports.ts`, `activity.ts`, `usage.ts`가 한다 |
| `ipc/agent-hooks.ts` | Claude Code 훅 명령(`agent_hooks_presence`, `install_agent_hooks`, `remove_agent_hooks`). 실패하면 오류 코드 |
| `ipc/sessions.ts` | 최근 세션 목록(`recent_sessions`, 최신부터), 이어 열 수 있는 세션(`resumable_sessions`), 세션 삭제(`delete_session`, 휴지통으로). 실행 중인 세션과 폴더가 없어진 세션은 백엔드가 이미 뺀다 |
| `ipc/folders.ts` | 폴더 명령: 커밋하지 않은 변경량(`git_changes`), git 저장소인지(`git_repos`), 폴더 선택 창(`pick_folder`) |
| `ipc/attention.ts` | 작업 표시줄 깜빡임 명령(`flash_taskbar`) |
| `ipc/window-menu.ts` | 창의 시스템 메뉴 명령(`show_window_menu`): 타이틀바 우클릭이면 마우스 자리, Alt+Space면 창 모서리 |
| `ipc/log.ts` | 프론트 로그 한 줄을 백엔드로(`frontend_log`. dev에서만 `app/log.ts`가 부른다) |
| `terminal/terminal-view.ts` | xterm 생성, fit·webgl addon, context loss 시 DOM 렌더러로 fallback. 닫을 때 WebGL 컨텍스트를 바로 놓아 준다(addon은 놓지 않아서 많이 열고 닫으면 페이지의 컨텍스트 한도에 닿는다). 더블클릭 단어 구분자는 heron-c와 같게(괄호, 따옴표, `<>`, `;`, `|`) |
| `terminal/flow-control.ts` | `write` 콜백으로 대기 바이트 추적, 256KB 넘으면 pause, 32KB 밑이면 resume |
| `terminal/keys.ts` | WebView 단축키 차단, Ctrl+C/V(붙여넣기는 브라우저의 paste 이벤트로 `clipboard.ts`가 받는다) |
| `terminal/clipboard.ts` | 복사·붙여넣기, 우클릭(선택 있으면 복사, 없으면 붙여넣기. 앱이 마우스 추적 중이면 앱에 넘김, Shift+우클릭은 항상 처리). 모든 붙여넣기(Ctrl+V, 우클릭, 파일 끌어 놓기)는 `pasteInto`를 거쳐서, bracketed paste 중에는 ESC를 빼 붙여넣은 글이 괄호를 일찍 닫고 키 입력처럼 실행되지 않게 한다 |
| `terminal/wheel.ts` | Shift+휠은 프로그램이 마우스를 추적해도 터미널이 스크롤한다(heron-c와 같다): 보통 화면은 스크롤백, 전체 화면 프로그램에는 화살표 키 |
| `terminal/links.ts` | 출력 속 URL과 OSC 8 링크를 Ctrl+클릭으로 브라우저에서 열기(opener 플러그인, http/https만. 앱이 마우스 추적 중이어도 링크 위 Ctrl+클릭은 앱에 넘기지 않음) |
| `terminal/cwd.ts` | 셸이 보내는 현재 폴더 신호(OSC 9;9, OSC 7) 해석. 신호는 프롬프트마다 오므로 "프롬프트로 돌아옴"도 알린다. 새 폴더를 먼저 알리고 프롬프트를 알려서, 프롬프트를 듣는 쪽이 새 폴더를 읽는다 |
| `pane/pane-item.ts` | 배치와 끌기가 pane(`pane.ts`)에 요구하는 것. 이 모듈들이 터미널에 직접 기대지 않게 한다 |
| `pane/pane.ts` | 터미널 pane 하나: 틀(`pane-frame.ts`), TerminalView, PtyLink, 글로우, 터미널 속 왜가리(`pane-herons.ts`)를 묶는다. 에이전트 상태 색, 셸의 현재 폴더 경로와 이름, 첫 프롬프트에 칠 명령(`start-command.ts`) |
| `pane/pane-frame.ts` | pane의 DOM: 헤더와 터미널이 그려질 상자를 담은 section. 헤더를 누르면 글자 선택 없이 그 pane에 포커스 |
| `pane/start-command.ts` | 새 pane의 셸이 처음 프롬프트를 띄우면 명령을 사용자가 친 것처럼 입력한다(`claude`, `claude --resume <id>`). Heron이 띄우는 셸은 모두 프롬프트를 알려서(`pty/cwd_report.rs`) 셸 시작과 엇갈리지 않는다 |
| `pane/pane-signals.ts` | 터미널 제목과 폴더를 헤더에, 신호(제목, 프롬프트, 키 입력과 그 키가 단독 Esc나 Ctrl+C인지, 포커스, 닫힘)를 에이전트 보드로. 에이전트 상태에 따른 점 색과 사이드바에서 가리킬 때의 테두리 class |
| `pane/shell-exits.ts` | 셸 종료 처리: exit 0이면 pane 닫기(설정으로 끌 수 있음), 실패면 남기고 뱃지 |
| `pane/pane-counts.ts` | 타이틀바 개수와 빈 화면용 숫자(터미널, 실행 중) |
| `pane/pty-link.ts` | TerminalView와 백엔드 PTY 연결: 출력, 입력, 크기, kill. 셸이 아직 도는지(시작했고 끝나지 않음)도 안다 |
| `pane/pane-header.ts` | 헤더 DOM: 상태 점, 셸 이름, exit 뱃지, 폴더, 터미널 제목, 실행 시간(시계 구독, 셸이 끝나면 멈춤), 닫기 |
| `pane/pane-motion.ts` | pane 등장·퇴장 애니메이션 |
| `pane/output-glow.ts` | 출력 시 테두리 글로우(0.3초)와 상태 점 pulse(3초). 조용한 셸에는 도는 애니메이션이 없다. pane당 최대 150ms에 한 번 class 토글 |
| `pane/pane-herons.ts` | 터미널 속 왜가리: pane의 터미널 위 캔버스. 에이전트가 있는 동안 설정한 수만큼(`buddy/flock.ts`) 움직이고 그린다. 움직이는 것이 있을 때만 프레임을 돌고, 1초 시계와 터미널 렌더가 깨운다(글자가 왜가리를 덮었을 수 있어서). 설정 > 애니메이션을 끄면 없고, 창이 숨으면 멈춘다 |
| `pane/heron-screen.ts` | xterm 화면을 왜가리가 보는 빈 칸으로(`buddy/ground.ts`의 `Screen`): 글자 없음, 기본 배경, 반전, 밑줄, 취소선 없음. 커서와 그 뒤 두 칸은 비워 둔다(xterm은 커서가 숨었는지 알려 주지 않아서 아래를 보고 있으면 늘) |
| `pane/heron-paint.ts` | 왜가리 그림을 캔버스에: 그림 글자를 테마 색 사각형으로(몸과 표시는 테마 토큰, 눈, 부리, 새끼, 반짝이, 나뭇가지는 고정 색), 가장자리를 기기 픽셀에 맞춰 이음매 없이 |
| `pane/pane-drag.ts` | 헤더를 잡고 다른 pane에 놓기: 가장자리면 그쪽으로 분할, 가운데면 자리 교체, Esc 취소. Tauri 파일 드롭 때문에 HTML5 drag가 안 와서 pointer 이벤트와 pointer capture를 쓴다 |
| `pane/file-drop.ts` | 파일을 pane에 끌어다 놓으면 경로를 입력(Windows Terminal 방식). Tauri 드래그 이벤트 사용 |
| `pane/pane-manager.ts` | 터미널 pane 목록, 추가(첫 프롬프트에 칠 명령도)·닫기, 여러 pane을 먼저 놓고 셸은 나중에 한꺼번에(`insertAll`, `startAll`), 글씨 크기, 저장할 배치와 되살리기. pane 신호를 pty id와 함께 넘긴다. 선택은 `pane-focus.ts`, 자리는 `pane-arranger.ts`, 셸 종료는 `shell-exits.ts`에 맡긴다 |
| `pane/pane-focus.ts` | 선택된 pane(키보드를 가진 pane): 포커스를 받은 pane이 되고, Ctrl+Tab으로 연 순서대로 돈다 |
| `pane/pane-arranger.ts` | pane이 놓이는 자리와 옮겨 가는 모습: `SplitLayout`으로 배치, 헤더 끌기(`pane-drag.ts`)로 옮기기, `flip`으로 미끄러지기, `FitScheduler`로 크기가 바뀐 pane만 다시 맞추기. 좌표 아래의 pane 찾기, 사용자 배치 저장과 되살리기 |
| `buddy/sprites.ts`, `buddy/sprites-heron.ts` | 순수: 픽셀 그림. 왜가리 자세 8가지(서기, 걷기 둘, 쪼기, 날기 둘, 외다리 잠, 날개 펴기, 12×14), 새끼 3가지, 머리 위 표시(!, ?, z, 생각 점), 반짝이, 나뭇가지. 글자 하나가 픽셀 하나이고 색은 `pane/heron-paint.ts`가 정한다 |
| `buddy/ground.ts` | 순수: 화면(`Screen`)에서 빈 칸 덩어리 찾기. 가장 아래(처음 나타날 때), 가장 가까운 곳(글자가 덮었을 때), 아무 곳(돌아다닐 때) |
| `buddy/crew-state.ts` | 순수: 왜가리 한 마리와 새끼들(crew)의 모양, 공용 상수와 도우미(난수, 날아가는 포물선 위치) |
| `buddy/crew.ts` | 순수: crew를 지금으로 옮기기. 에이전트 상태로 기분 정하기(작업 중, 권한 요청 !, 질문과 대기 ?, 끝남, 쉼), 나타나고 사라질 때 300ms 흐려지기, 끝나면 반짝이 셋. 동기화 출력 중에는 자리 판단을 미룬다 |
| `buddy/crew-moves.ts` | 순수: 빈 칸 지키기(덮이면 가장 가까운 빈 곳으로 날아가고, 없으면 사라졌다 자리가 나면 날아 들어온다), 일하는 동안 걷기, 쪼기, 쉬기, 다른 빈 곳으로 날아가기 |
| `buddy/crew-paces.ts` | 순수: 일하는 왜가리의 걸음을 에이전트가 하는 일에 맞추기. 읽기와 찾기는 자주 쪼고, 실행은 뛰고, 웹은 자주 날아다니고, 생각은 멈춰 선다 |
| `buddy/crew-chicks.ts` | 순수: 새끼(서브에이전트마다 하나, 최대 6): pane의 왜가리들에게 돌아가며 나누고, 뒤로 줄지어 따라가고, 떠날 때 반짝이 |
| `buddy/crew-pose.ts` | 순수: 지금 그릴 그림 목록(그림, 위치, 좌우 뒤집기, 투명도)과 다음 프레임까지 기다릴 시간. 수정 중에는 부리에 나뭇가지, 생각 중에는 머리 위 점 |
| `buddy/flock.ts` | 순수: pane 하나의 왜가리들. 에이전트가 있는 동안 설정한 수만큼 crew를 두고, 새끼를 나누고, 더 원하지 않는 crew는 다 흐려진 뒤 뺀다 |
| `layout/grid.ts` | 순수 함수: 자동 격자에서 줄마다 pane 몇 개인지 계산 |
| `layout/split-tree.ts` | 순수 함수: 분할 트리(가로 `row`, 세로 `column`, 비율 `sizes`). 자동 격자 트리, 삽입, 제거(형제가 공간을 나눠 가짐), 이동, 교체 |
| `layout/split-rects.ts` | 순수 함수: 트리를 px 박스와 경계선 박스로. 가장자리를 정수로 반올림해 글자가 흐려지지 않게 한다 |
| `layout/drop-zone.ts` | 순수 함수: 끌어 놓은 위치가 어느 쪽인지(바깥 1/4은 분할, 가운데는 교체), 미리보기 박스 |
| `layout/tree-shape.ts` | 순수 함수: 분할 트리의 pane을 순서 번호로 바꾼 모양(저장용)과, 읽어 온 모양을 pane들로 되돌리기. pane마다 정확히 한 번, 비율은 양수이고 합이 1일 때만 쓴다 |
| `layout/split-layout.ts` | 트리를 workspace에 적용. 자동 모드는 추가·닫기마다 격자로 다시 만들고, 첫 끌기나 경계선 이동부터 수동 모드. 수동 배치는 모양으로 저장하고 되살린다(`tree-shape.ts`). pane은 workspace 바로 아래에 두고 절대 좌표만 준다(터미널을 다른 부모로 옮기지 않음) |
| `layout/dividers.ts` | pane 사이 틈의 경계선. 끌면 이웃 두 pane 비율 조절(최소 80px), 더블클릭은 반반 |
| `layout/box-style.ts` | 절대 위치 요소에 px 박스 적용 |
| `layout/fit-scheduler.ts` | ResizeObserver + requestAnimationFrame으로 fit을 묶음. 프레임당 10ms 예산, 남으면 다음 프레임 |
| `layout/flip.ts` | 재배치 시 이전 위치에서 새 위치로 transform 애니메이션 |
| `styles/stylesheets.ts` | 앱의 모든 스타일시트를 캐스케이드 순서대로 import(xterm, 테마 토큰과 기본 규칙, 기능별 파일) |
| `styles/*.css` | 기능별 스타일: `themes`(색 토큰, black/green, 활동 종류 색 `--act-*`), `base`, `titlebar`, `controls`, `shell-menu`, `workspace`(사이드바와 작업 영역을 나란히), `pane`(왜가리 캔버스 층 포함), `split`(경계선, 드롭 미리보기), `settings`, `empty-state`, `agent-sidebar`(사이드바 틀), `agent-item`(사이드바 한 줄, 모델, 변경량), `agent-activity`(지금 하는 일의 점, 이번 턴 도구 블록과 종류 색), `agent-tokens`(토큰 줄), `subagent-lines`(줄 아래 서브에이전트), `agent-marks`(배지와 pane 점의 에이전트 상태 색, 가리킨 pane 테두리), `agent-hints`(사이드바 아래 안내), `new-agent`(새 에이전트 split 버튼), `agent-folder-menu`(폴더 메뉴), `recent-sessions`(최근 세션 틀, 가장자리 "더 있음"), `recent-group-head`(폴더 머리), `recent-session-row`(세션 한 줄, 삭제 질문), `usage-bar`(하단바, 한도 블록, 컨텍스트 칩), `effects`(Animations 끄기 규칙 포함. 상태 점은 출력이 올 때만, 에이전트가 일하는 pane에서는 깜빡이지 않는다) |

의존 방향: `main.ts`, `wire-*.ts` → `ui/`, `pane/`, `layout/` → `buddy/` → `agent/`, `terminal/`, `ipc/`, `app/`, `i18n/`. (`ui/`, `pane/`, `layout/`은 `buddy/` 아래 모듈도 바로 쓴다.)
`wire-*.ts`끼리는 `wire-agents.ts` → `wire-changes.ts`만 있다. 나머지는 `main.ts`가 서로의 함수를 넘겨 잇는다.
`agent/`는 `ipc/`의 타입, `app/log.ts`, `app/paths.ts`, `app/unchecked.ts`만 import한다(화면 모듈을 모른다).
`buddy/`는 `agent/`의 타입만 import한다(DOM과 시계를 모른다. 화면은 `Screen`으로, 시각은 인자로 받는다).
`ipc/`, `i18n/`, `layout/grid.ts`는 다른 앱 모듈을 import하지 않는다.
`app/`에서 `ipc/`의 명령을 부르는 곳은 `app/agent-hooks.ts`와 `app/log.ts`(dev 로그를 백엔드 터미널로)뿐이다.
`layout/split-tree.ts`, `split-rects.ts`, `drop-zone.ts`는 `layout/` 안의 순수 모듈만 import한다(DOM 없음).

## 백엔드 `src-tauri/src/`

| 경로 | 역할 |
| --- | --- |
| `main.rs` | `run_cli()`가 훅 실행이나 훅 제거로 불린 것이면 창 없이 그 일만 하고 끝낸다. 아니면 `run()` |
| `lib.rs` | `run_cli()`(`--agent-hook`, `--remove-agent-hooks`), Builder 구성(opener, dialog 플러그인), 명령 등록, `AgentLink` 생성. 앱 페이지(main)가 다시 로드되거나 앱이 끝나면 모든 PTY kill과 에이전트 파일 정리 |
| `window.rs` | 메인 창 생성. 설정 파일로 못 켜는 옵션(클립보드 읽기 자동 허용) 때문에 코드에서 만든다 |
| `attention.rs` | 다른 앱이 앞에 있을 때 작업 표시줄 버튼 깜빡임(명령은 `commands/window.rs`의 `flash_taskbar`). Tauri의 `requestUserAttention`은 창이 자기 스레드의 활성 창이기만 해도 건너뛰어서(tao#942와 같은 원인) 맨 앞 창을 확인한 뒤 user32 `FlashWindowEx`를 직접 부른다 |
| `window_menu.rs` | 창의 시스템 메뉴(복원, 이동, 크기 조정, 최소화, 최대화, 닫기): Windows Terminal처럼 창 상태에 맞게 항목을 켜고 끄고(`TrackPopupMenu`는 그대로 두므로), 메뉴를 띄워 고른 명령을 `WM_SYSCOMMAND`로 창에 보낸다. 최대화된 창은 복원, 최소화, 닫기만. WebView2가 Alt+Space를 삼키므로(WebView2Feedback#3840) 페이지가 받아서 부른다 |
| `launch.rs` | 명령줄 폴더 인자("Open in Heron")를 첫 pane에 한 번 넘기기(명령은 `commands/window.rs`의 `take_launch_dir`), 이미 켜져 있으면 그 창에 pane 추가(single-instance 플러그인, release 빌드만) |
| `logging.rs` | dev용 stderr 로거. release에서는 로그 호출이 컴파일에서 빠진다 |
| `commands/mod.rs` | Tauri 명령. 인자만 넘기고 각 모듈에 위임. 프론트 로그(`frontend_log`) |
| `commands/pty.rs` | 셸과 터미널 명령. 셸 명령에 pane의 에이전트 변수를 넣는 곳이 여기라 `pty`는 에이전트를 모른다 |
| `commands/claude.rs` | Claude Code 명령: 훅 상태·설치·제거(`claude_hooks`), 최근 세션, 이어 열 수 있는 세션, 세션 삭제(`sessions`) |
| `commands/folders.rs` | 폴더 명령: 커밋하지 않은 변경량과 git 저장소인지(`git`), 폴더 선택 창(dialog 플러그인, 창 위에 모달) |
| `commands/window.rs` | 창 명령: 작업 표시줄 깜빡임(`attention`), Heron을 연 폴더(`launch`), 시스템 메뉴(`window_menu`, UI 스레드에서) |
| `git/mod.rs` | PATH의 git을 콘솔 창 없이, git의 선택적 잠금 없이(`GIT_OPTIONAL_LOCKS=0`, 에이전트의 git과 부딪히지 않게) 실행. 저장소 맨 위 폴더(`.git` 폴더나 파일을 위로 찾기), HEAD에서 바뀐 tracked 변경(staged 포함)과 무시되지 않은 새 파일. 커밋이 없는 저장소는 빈 트리와 비교. 새 파일은 2MB 이하, 200개까지만 줄을 센다(`new_files.rs`) |
| `git/new_files.rs` | 새(추적하지 않는) 파일의 줄 수를 파일 버전마다 한 번만 센다(크기와 수정 시각, `file_stamp.rs`). 일하는 에이전트의 폴더는 15초마다 묻는데 그사이 새 파일은 대개 그대로다 |
| `git/numstat.rs` | 순수 함수: `git diff --numstat` 합계(바이너리는 줄 없이 파일만), 새 파일의 줄 수(NUL이 있으면 바이너리) |
| `claude_version.rs` | 순수 함수: Claude Code 버전 문자열(`claude --version` 출력, 기록 파일 항목의 `version`)을 숫자 셋으로. `claude_hooks/`와 `agent/`가 함께 쓴다 |
| `claude_dir.rs` | Claude Code 설정 폴더(CLAUDE_CONFIG_DIR 또는 `%USERPROFILE%\.claude`). `claude_hooks/`가 settings.json을, `sessions/`가 세션 파일을 여기서 찾는다 |
| `epoch.rs` | 시각을 1970년부터의 ms로(에이전트 파일, 세션 목록, 프론트와 같은 단위) |
| `text.rs` | 순수 함수: 한 줄에 맞게 글 자르기(N자 뒤에 `…`). 도구 설명, 세션 제목, 에이전트가 다루는 대상 |
| `hidden_command.rs` | 콘솔 창 없이 도우미 프로그램(git, `claude --version`) 실행 |
| `file_stamp.rs` | 파일이 지난번 읽은 뒤 바뀌었는지 알려 주는 것(크기와 수정 시각). 세션 요약과 새 파일 줄 수의 캐시가 쓴다 |
| `agent/mod.rs` | `AgentLink`: pane마다 셸에 `HERON_PANE`(키 `<pid>-<pty id>`)와 `HERON_AGENT_DIR`(`%LOCALAPPDATA%\io.github.seonggyujo.heron\agents`)을 넣고, pane이 닫히면 그 pane 파일을 지운다. 파일은 Heron 훅(`claude_hooks/`)과 heron-limits 플러그인이 쓴다 |
| `agent/file_names.rs` | 순수 함수: pane 파일 이름(`<키>.state.json`과 `<키>.model.json`은 훅, `<키>.status.json`은 플러그인 상태줄, 서브에이전트마다 `<키>.sub.<id>.json`은 훅)과 키·서브에이전트 id 검사(`claude_hooks/entry.rs`가 환경변수나 훅 입력으로 파일 이름을 만들 때 폴더 밖으로 나가지 않게) |
| `agent/files.rs` | pane의 파일 찾기와 지우기: 닫힌 pane의 파일(서브에이전트 파일 포함), 하루 지난 파일 정리 |
| `agent/subagents.rs` | pane 하나의 서브에이전트 파일을 읽어 목록으로(id, 종류, 시작 시각, 오래된 것부터) |
| `agent/poll.rs` | 0.7초마다 살아 있는 pane마다 `watch.rs`를 한 번 돌리고, 나온 소식을 `agent-update` 이벤트로 프론트에 보낸다 |
| `agent/watch.rs` | pane 하나를 지켜보는 일: 파일의 수정 시각을 보고 바뀐 상태 파일과 상태줄 파일은 그대로 보낸다. 서브에이전트 목록이 바뀌면 `subagents`로 보낸다. 상태 파일이 알려 준 기록 파일(`conversation.rs`)에서 활동이 바뀌면 `activity`로, 토큰이 바뀌면 `tokens`로 보내고, 모델 파일의 선택 모델(훅이 모르면 상태줄 파일의 `model`)로 모델 확인을 해서 판정이 바뀌면 `check`를 보낸다. 새 답을 먼저 판정하고 그다음 새 선택을 받아서, 바꾸기 전의 답은 바꾸기 전 모델과 비교한다. 쓰는 쪽은 쓰고 나서 이름을 바꾸므로 반쯤 쓴 파일을 읽지 않는다 |
| `agent/conversation.rs` | 훅이 알려 준 기록 파일 하나와 거기서 읽는 것: 새 답의 모델(모델 확인용), 활동(`activity.rs`), 토큰(`tokens.rs`). 따라 읽기 전에 쓰인 앞부분의 토큰은 `token_scan.rs`가 따로 세어 오면 더한다 |
| `agent/transcript.rs` | 기록 파일 하나를 따라 읽기(테스트는 `transcript_tests.rs`): 지난번 이후 새로 끝난 줄에서 대화 항목(user, assistant)을 한 번씩 파싱해 돌려주고, 그중 답은 응답마다 한 번씩 따로 준다. 파일 끝에서 시작하고, 따라 읽기 전에 쓰인 항목(재개한 세션, 갈래 친 세션의 사본)은 그때 선택 모델을 모르고 그 일은 이미 끝났으므로 건너뛴다 |
| `agent/answers.rs` | 순수 함수: 기록 파일의 항목 하나에서 본 대화의 답(`message.id`, `message.model`, 시각)을 꺼낸다. 서브에이전트(`isSidechain`), `<synthetic>`, 모델 변경 훅이 없는 Claude Code(2.1.251 미만)가 쓴 답은 뺀다. `[1m]`, 날짜 꼬리를 빼고 모델 비교 |
| `agent/activity.rs` | 순수 함수: 기록 파일의 항목으로 에이전트가 하는 일을 따라간다. 지금 단계(생각, 답 쓰기, 도구와 그 대상: 파일 이름, 에이전트가 붙인 설명, 명령 첫 줄, 페이지 호스트, 패턴이나 검색어. 80자까지)와 이번 턴의 도구 호출(최대 40개, 끝났는지). 도구 호출은 시작할 때, 결과는 끝날 때 쓰이고, 사용자의 프롬프트가 새 턴을 연다. 서브에이전트 항목은 뺀다. 테스트는 `activity_tests.rs` |
| `agent/entries.rs` | 순수 함수: 기록 파일 항목이 무엇인지. 서브에이전트의 것인지, 답인지와 그 내용 블록, 도구 결과, 새 턴을 여는 사용자 프롬프트인지(`isMeta`가 아닌 것). `activity.rs`와 `tokens.rs`가 함께 쓴다 |
| `agent/tokens.rs` | 순수 함수: 본 대화의 답마다 `usage`(입력, 출력, 캐시 쓰기, 캐시 읽기)로 세션 전체와 이번 턴의 토큰. 한 답은 같은 message id의 여러 줄이라 id마다 마지막 usage로 한 번만 센다. 프롬프트가 턴을 새로 연다. 테스트는 `tokens_tests.rs` |
| `agent/token_scan.rs` | 따라 읽기 전에 쓰인 기록 파일 앞부분의 토큰을 따로 스레드에서 센다(긴 세션의 파일은 수백 MB라 폴링이 기다리지 않게). `"usage"`가 없는 줄은 파싱하지 않는다 |
| `agent/timestamps.rs` | 순수 함수: 기록 파일의 시각(UTC `...Z`)을 ms로 |
| `agent/model_check.rs` | 순수 함수: 답마다 그 답이 왔을 때의 선택 모델과 한 번만 비교한다. 선택 모델은 훅이 알려 준 것, 훅이 모르면(이어서 연 세션) 지금 기록 파일의 세션에서 상태줄이 알려 준 것. 판정은 ok, mismatch, pending(답이 없거나, 선택을 모르거나, 답 뒤에 모델을 바꿨을 때) |
| `claude_hooks/mod.rs` | Heron 자체 Claude Code 훅의 진입점: 상태 확인, 설치(먼저 버전 확인), 제거, 오류 코드. 플러그인 없이도 권한 요청, 질문, 끝남, 모델 확인을 하게 한다 |
| `claude_hooks/entry.rs` | `heron.exe --agent-hook`으로 실행됐을 때: 훅 입력(JSON)을 `records.rs`로 바꿔 pane의 상태 파일과 모델 파일, 서브에이전트 파일에 쓰거나 지우고 끝난다. 30초 안에 쓴 이전 상태 기록도 읽어 `records.rs`에 넘긴다. 아무것도 출력하지 않는다. Heron pane 밖이면 입력을 읽기 전에 끝난다 |
| `claude_hooks/records.rs` | 순수 함수: 훅 이벤트 하나가 쓰는 것. 상태 파일에는 상태, 권한 요청이나 알림 내용, 작업 폴더, 기록 파일 경로. 모델 파일에는 `SessionStart`의 `model`이나 `PostModelSwitch`의 `to_model`. 모델이 없는 `SessionStart`(이어서 연 세션)는 "모름"(null)을 써서 같은 pane의 이전 세션 모델이 남지 않게 하고, `/clear`는 그대로 둔다. `PermissionRequest` 바로 뒤에 오는 권한 알림은 요청의 도구와 명령을 덮어쓰지 않는다. 서브에이전트 파일: `SubagentStart`에 쓰고(종류, 시작 시각) `SubagentStop`에 지우고, 세션이 시작하거나 끝나면 모두 지운다. 테스트는 `records_tests.rs` |
| `claude_hooks/config.rs` | settings.json `hooks` 안의 Heron 항목 넣기, 빼기, 있는지 보기(순수 함수). 이벤트 10개(`PostModelSwitch`, `SubagentStart`, `SubagentStop` 포함. `PostModelSwitch`를 모르는 버전은 그 항목만 건너뛴다). heron.exe를 `--agent-hook`으로 부르는 항목만 우리 것으로 보고 사용자의 훅은 건드리지 않는다. 이벤트가 하나라도 빠지면 오래된 설치로 보고 앱이 시작할 때 다시 넣는다. 테스트는 `config_tests.rs` |
| `claude_hooks/settings_file.rs` | 설정 폴더(`claude_dir.rs`)의 `settings.json` 읽기와 쓰기. 쓰기 전에 옆에 `.heron-backup` 사본, 임시 파일에 쓰고 이름 바꾸기. 올바른 JSON이 아니면 쓰지 않는다 |
| `claude_hooks/version.rs` | `claude --version` 확인. 2.1.139 미만은 훅 항목의 `args`를 무시해서 이벤트마다 앱을 띄울 수 있으므로 설치하지 않는다 |
| `sessions/mod.rs` | 사이드바의 최근 세션: `projects/<프로젝트>/<id>.jsonl` 중 최근에 쓴 것부터 끝 256KB만 읽어 요약(`summary.rs`), 바뀌지 않은 파일은 다시 읽지 않는다(`cache.rs`). 지금 실행 중인 세션(`live.rs`)은 읽기 전에, 폴더가 없어진 세션은 읽은 뒤 뺀다. 이어 열 수 있는 세션: 파일이 있고(Claude Code는 첫 메시지 때 세션 파일을 쓴다) 실행 중이 아닌 것. 세션 삭제: 그 파일과 옆의 같은 이름 폴더(서브에이전트, 도구 출력)를 휴지통으로(`recycle.rs`). 실행 중이거나 모르는 id는 거절 |
| `sessions/cache.rs` | 세션 파일마다 읽은 요약을 크기와 수정 시각(`file_stamp.rs`)과 함께 기억한다. 사이드바는 창 포커스마다 묻는다. 없어진 파일은 잊는다 |
| `sessions/summary.rs` | 순수 함수: 세션 파일 끝에서 마지막 작업 폴더(`cwd`)와 제목. 제목은 사용자가 붙인 것(`custom-title`), 없으면 자동 제목(`ai-title`), 없으면 마지막 질문(`last-prompt`). 종류마다 마지막 기록이 이긴다(Claude Code와 같다). 첫 줄이 잘렸으면 건너뛴다. 셸에 칠 세션 id는 UUID 모양만 |
| `sessions/live.rs` | 지금 어느 터미널에서든 Claude Code가 돌리고 있는 세션: Claude Code가 프로세스마다 쓰는 `sessions/<pid>.json`의 세션 id. 프로세스가 없어진 파일(비정상 종료)은 세지 않는다 |
| `sessions/recycle.rs` | 파일과 폴더를 휴지통으로(`SHFileOperationW`, 되살리기 허용, 대화 상자 없음) |
| `pty/mod.rs` | `pty` 모듈 공개 API |
| `pty/ctrl_c.rs` | 시작할 때 물려받은 "Ctrl+C 무시" 상태를 푼다(`SetConsoleCtrlHandler(NULL, FALSE)`). 새 프로세스 그룹으로 실행되면 이 상태가 셸까지 물려져서 pane에서 ^C가 안 먹는다. Windows Terminal과 같은 처리 |
| `pty/registry.rs` | id → 세션 맵. 락은 조회·삽입·삭제 동안만. 새 id가 정해진 뒤 호출한 쪽에 셸 명령을 받아 실행한다 |
| `pty/session.rs` | 세션 하나: 생성, 입력 큐, 크기 조정, pause, kill, close |
| `pty/shell.rs` | 셸 종류(pwsh 7, Windows PowerShell, cmd, Git Bash), 설치 여부, 실행 명령 |
| `pty/cwd_report.rs` | 셸 세션에만 현재 폴더 신호(OSC 9;9) 훅을 건다. 화면과 프로필 파일은 그대로. 셸 종류는 모르고, `shell.rs`가 셸에 맞는 함수를 부른다 |
| `pty/writer.rs` | 입력 스레드. 명령은 큐에 넣기만 해서 키 순서 보장, 메인 스레드 안 막음 |
| `pty/reader.rs` | 64KB 블로킹 read 스레드, 용량 4의 bounded channel로 backpressure |
| `pty/gate.rs` | pause 스위치(Mutex + Condvar) |
| `pty/batcher.rs` | 12ms 간격 또는 64KB 단위 flush, `InvokeResponseBody::Raw`로 전송 |
| `pty/waiter.rs` | 자식 종료 대기 → 콘솔 닫기(`session.rs`가 넘긴 함수) → 마지막 출력 flush → `pty-exit` 발행 |

의존 방향: `lib.rs`, `commands/` → `claude_hooks/`, `agent/`, `pty/`, `sessions/`, `git/`, `attention.rs`, `launch.rs`, `window_menu.rs` → `claude_version.rs`, `claude_dir.rs`, `epoch.rs`, `text.rs`, `hidden_command.rs`, `file_stamp.rs`.
`#[tauri::command]` 함수는 `commands/`에만 둔다.
`claude_hooks/entry.rs`는 `agent`가 내보낸 파일 이름 함수와 서브에이전트 파일 정리 함수만 쓰고, `agent/`는 `claude_hooks/`를 모른다.

## 플러그인 `plugin/` (heron-limits)

Claude Code가 상태줄로만 주는 값(5시간·주간 사용 한도, 컨텍스트 사용률)을 Heron에 넘기는 Claude Code 플러그인.
저장소 맨 위 `.claude-plugin/marketplace.json`이 이 저장소를 마켓플레이스 `heron`으로 만들고, 플러그인은 `./plugin`을 가리킨다
(`/plugin marketplace add seonggyujo/heron`, `/plugin install heron-limits@heron`). Heron 앱과 따로 버전을 매긴다(`plugin/.claude-plugin/plugin.json`).

| 경로 | 역할 |
| --- | --- |
| `setup.js` | `sync`(SessionStart 훅): 상태줄 자리를 가져오고, 쓰던 상태줄은 저장해서 우리 것 안에서 돌린다(`refreshInterval`, `padding`은 그대로). 설치된 사본을 플러그인 버전에 맞춘다. `first-run`(UserPromptSubmit 훅): 처음 한 번만 `sync`. `disable`: 쓰던 상태줄을 돌려놓고 사본을 지운다. settings.json은 `~/.claude/heron-limits/`의 사본을 가리킨다(플러그인 폴더는 버전마다 바뀌고, 플러그인을 지워도 사본은 계속 돈다) |
| `statusline.js` | 상태줄 진입점: Heron pane 안이면 `heron-file.js`로 파일을 쓰고, `previous.js`가 돌린 쓰던 상태줄의 출력을 그대로 찍는다. 없으면 아무것도 찍지 않는다 |
| `heron-file.js` | `<키>.status.json`에 한도(사용률, 초기화 시각), 컨텍스트 사용률, 선택 모델(`model.id`, 훅이 모르는 이어서 연 세션용). pane 키 모양이 아니면 쓰지 않는다 |
| `previous.js` | 저장한 사용자 상태줄을 같은 입력으로 실행(Git Bash, 없으면 기본 셸). 3초 안에 끝나지 않거나 실패하면 출력 없음. 저장 파일 이름(`setup.js`가 쓴다) |
| `replace-file.js` | 파일을 한 번에 바꾸기(임시 파일에 쓰고 이름 바꾸기). `setup.js`와 `heron-file.js`가 쓴다 |
| `skills/disable/` | `/heron-limits:disable` |
| `hooks/hooks.json` | 플러그인의 Claude Code 훅: SessionStart에 `setup.js sync`, UserPromptSubmit에 `setup.js first-run` |
| `README.md` | 플러그인 설명과 설치, 끄기 |
| `test/` | `node --test "test/*.test.js"`: 설정 가져오기와 되돌리기, 출력 그대로 전달, Heron 파일 |

`plugin/package.json`은 `"type": "commonjs"`다. 저장소 맨 위 `package.json`이 ES 모듈이라서, 없으면 저장소 안에서 실행한 스크립트가 깨진다.

## 스크립트 `scripts/`

| 경로 | 역할 |
| --- | --- |
| `demo/` | README GIF 녹화. SendInput으로 앱을 조작하고 ffmpeg로 녹화, GIF 변환. 사용법은 `scripts/demo/README.md` |
| `installer/make-images.ps1` | 설치 창 이미지(NSIS 사이드바·헤더, MSI 배경·배너)를 `src-tauri/icons/icon.png`로 그려 `src-tauri/installer/`에 저장. 아이콘을 바꾸면 다시 실행 |

## 로그

- `npm run tauri:dev` 터미널에 Rust 로그와 프론트 로그(`web` 대상)가 함께 나온다.
- 레벨은 환경변수 `HERON_LOG`(error, warn, info, debug, trace)로 바꾼다. 기본 debug.
  `trace`는 출력 flush마다 한 줄을 찍으니 필요할 때만 쓴다.
  PowerShell: `$env:HERON_LOG = "trace"; npm run tauri:dev`
- 출력 청크마다 찍는 로그는 trace에만 둔다. 다른 레벨에서 hot path 로그 금지.
- 기본(debug)에서 나오는 것: 셸 시작·종료·크기, 현재 폴더 변화(`[cwd]`), 배치 변화, 막힌 링크, 설정 변경(`[settings]`), 막힌 브라우저 단축키(`[keys]`), 다음 프레임으로 밀린 fit(`[fit]`), 에이전트 파일 변화(`agent:`), 작업 표시줄 깜빡임(`attention:`).
- `trace`에서만 나오는 것: 출력 flush.

## 설정

- `src-tauri/tauri.conf.json`: 창은 `create: false`(`window.rs`에서 생성), `decorations: false`(자체 타이틀바), `shadow: true`(Windows 11 둥근 모서리와 그림자). CSP는 `'self'`와 IPC만 허용. `bundle`의 `publisher`, `copyright`가 exe 속성(회사, 저작권)과 설치 정보의 게시자가 된다. 비워 두면 게시자가 식별자의 두 번째 칸("github")이 된다.
- `src-tauri/capabilities/default.json`: 이벤트와 창 조작(닫기, 최소화, 최대화, 드래그)만 허용.
- `tauri.conf.json` `bundle.windows`: 설치 파일 아이콘과 설치 창 이미지(`src-tauri/installer/*.bmp`).
- `src-tauri/installer/hooks.nsh`, `context-menu.wxs`: 탐색기 우클릭 "Open in Heron" 등록과 제거(NSIS, MSI). 서명 없는 클래식 메뉴라 Windows 11에서는 "추가 옵션 표시" 안에 나온다.
- 삭제할 때 `heron.exe --remove-agent-hooks`로 Claude Code 훅을 뺀다(NSIS는 `hooks.nsh`, MSI는 `agent-hooks.wxs`). 업데이트할 때도 빠지지만 새 버전이 시작하면 다시 넣는다.
- `Cargo.toml`: `serde_json`의 `preserve_order`를 켜서 사용자의 settings.json 키 순서를 그대로 둔다.
- `build.rs`: `icons/`가 바뀌면 다시 실행되게 해서 exe에 새 아이콘이 들어가게 한다.
- `src-tauri/icons/icon-source.png`: 앱 아이콘 원본(1024px). `npm run tauri icon src-tauri/icons/icon-source.png`로 모든 크기를 만든 뒤 저장소에 두는 6개(`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png`, `icon.ico`, 원본)만 남긴다. 설치 이미지는 `scripts/installer/make-images.ps1`로 다시 그린다.
- `Cargo.toml` release 프로필: `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`, `opt-level = "s"`.

## 성능 원칙 (측정으로 확인한 것)

- 계속 도는 CSS 애니메이션은 하나만 있어도 WebView가 매 프레임을 다시 그린다. 대기 CPU가 0.01%에서 0.9%로 오른다. 무한 애니메이션은 출력이 있을 때처럼 필요한 동안에만 켠다.
- 여러 터미널의 fit을 한 프레임에 몰면 long task가 된다(6개에 94ms). `fit-scheduler`의 프레임 예산을 지킨다.
- 터미널 속 왜가리는 움직이는 동안만 프레임을 돈다(에이전트가 일하는 동안 약 30fps). 자거나 서 있으면 1초 시계에만 깨어나서, 쉬는 에이전트만 있는 앱은 이전처럼 프레임을 만들지 않는다. 이 비용은 아직 측정하지 않았다.
- 같은 것을 다시 그리지 않는다. 터미널 제목과 플러그인 상태줄 파일은 바뀐 게 없어도 자주 온다(xterm은 같은 제목도 매번 알리고, 플러그인은 쓸 때마다 시각을 바꾼다). 보드는 이때 에이전트를 그대로 두어 사이드바와 하단바를 다시 만들지 않는다.
- 창 포커스(Alt+Tab)마다 하는 일은 싸게 둔다. 세션 요약과 새 파일 줄 수는 바뀐 파일만 다시 읽고, git은 10초 안에 물은 폴더를 건너뛴다.
- 측정 수치는 `docs/PERFORMANCE.md`에 있다.
