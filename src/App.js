import { OpenVidu } from 'openvidu-browser';

import axios from 'axios';
import React, { Component } from 'react';
import './App.css';
import UserVideoComponent from './UserVideoComponent';

const APPLICATION_SERVER_URL = process.env.NODE_ENV === 'production' ? '' : 'https://demos.openvidu.io/';

class App extends Component {
    constructor(props) {
        super(props);

        // 이러한 속성들은 상태(state)의 컴포넌트에 있으며, 그 값이 변경될 때마다 HTML을 다시 렌더링하기 위해 사용됩니다.
        this.state = {
            mySessionId: 'SessionA',
            myUserName: 'Participant' + Math.floor(Math.random() * 100),
            session: undefined,
            mainStreamManager: undefined,  // 페이지의 주요 비디오입니다. 'publisher' 또는 'subscribers' 중 하나가 될 것입니다.
            publisher: undefined,
            subscribers: [],
        };

        this.joinSession = this.joinSession.bind(this);
        this.leaveSession = this.leaveSession.bind(this);
        this.switchCamera = this.switchCamera.bind(this);
        this.handleChangeSessionId = this.handleChangeSessionId.bind(this);
        this.handleChangeUserName = this.handleChangeUserName.bind(this);
        this.handleMainVideoStream = this.handleMainVideoStream.bind(this);
        this.onbeforeunload = this.onbeforeunload.bind(this);
    }

    componentDidMount() {
        window.addEventListener('beforeunload', this.onbeforeunload);
    }

    componentWillUnmount() {
        window.removeEventListener('beforeunload', this.onbeforeunload);
    }
    // 페이지를 떠날 때 세션을 종료하기 위해 호출되는 메서드입니다.
    onbeforeunload(event) {
        this.leaveSession();
    }
    // 세션 ID 입력 필드의 변경을 처리하는 메서드입니다.
    handleChangeSessionId(e) {
        this.setState({
            mySessionId: e.target.value,
        });
    }
    // 사용자 이름 입력 필드의 변경을 처리하는 메서드입니다.
    handleChangeUserName(e) {
        this.setState({
            myUserName: e.target.value,
        });
    }
    // 메인 비디오 스트림을 처리하는 메서드입니다. 스트림이 변경되면 상태를 업데이트하여 HTML을 다시 렌더링합니다.
    handleMainVideoStream(stream) {
        if (this.state.mainStreamManager !== stream) {
            this.setState({
                mainStreamManager: stream
            });
        }
    }
    // 구독자를 삭제하는 메서드입니다. 스트림 매니저를 구독자 목록에서 제거하고 상태를 업데이트하여 HTML을 다시 렌더링합니다.
    deleteSubscriber(streamManager) {
        let subscribers = this.state.subscribers;
        let index = subscribers.indexOf(streamManager, 0);
        if (index > -1) {
            subscribers.splice(index, 1);
            this.setState({
                subscribers: subscribers,
            });
        }
    }
    // 세션에 참여하기 위해 호출되는 메서드입니다.
    joinSession() {
        // --- 1) OpenVidu 객체 가져오기 ---

        this.OV = new OpenVidu();

        // --- 2) 세션 초기화 ---

        this.setState(
            {
                session: this.OV.initSession(),
            },
            () => {
                var mySession = this.state.session;

                // --- 3) 세션에서 이벤트 발생 시 수행할 작업 지정하기 ---

                // 새로운 스트림이 수신되면...
                mySession.on('stream', (event) => {
                    // 스트림을 수신하기 위해 구독합니다. 두 번째 매개변수가 정의되지 않았습니다.
                    // 그래서 OpenVidu는 자체 HTML 비디오를 생성하지 않습니다.
                    var subscriber = mySession.subscribe(event.stream, undefined);
                    var subscribers = this.state.subscribers;
                    subscribers.push(subscriber);

                    // 새 구독자들로 상태 업데이트하기
                    this.setState({
                        subscribers: subscribers,
                    });
                });

                // 스트림이 삭제될 때...
                mySession.on('streamDestroyed', (event) => {

                    // 'subscribers' 배열에서 스트림 삭제하기
                    this.deleteSubscriber(event.stream.streamManager);
                });

                // 비동기 예외 발생 시...
                mySession.on('exception', (exception) => {
                    console.warn(exception);
                });

                // --- 4) 유효한 사용자 토큰으로 세션에 연결하기 ---

                // OpenVidu 배포로부터 토큰을 가져옵니다.
                this.getToken().then((token) => {
                    // 첫 번째 매개변수는 OpenVidu 배포에서 발급 받은 토큰입니다.
                    // 두 번째 매개변수는 'streamCreated' 이벤트에서 사용자가 받은 
                    // 데이터 (프로퍼티 Stream.connection.data)로, DOM에 사용자의 별명으로 추가됩니다.
                    mySession.connect(token, { clientData: this.state.myUserName })
                        .then(async () => {

                            // --- 5) 자신의 카메라 스트림 받기 ---

                            // targetElement에 undefined를 전달하여 퍼블리셔를 초기화합니다.
                            // (OpenVidu가 원하는대로 비디오 요소를 삽입하지 않으며, 우리 자신이 관리합니다)
                            // 필요한 속성들과 함께
                            let publisher = await this.OV.initPublisherAsync(undefined, {
                                audioSource: undefined, // 오디오의 소스입니다. 정의되지 않은 경우 기본 마이크
                                videoSource: undefined, // 비디오의 소스입니다. 정의되지 않은 경우 기본 웹캠.
                                publishAudio: true,     // 오디오를 무음으로 시작할지 여부
                                publishVideo: true,     // 비디오를 활성화하여 시작할지 여부
                                resolution: '640x480',  // 비디오의 해상도
                                frameRate: 30,          // 비디오의 프레임 레이트
                                insertMode: 'APPEND',   // 비디오가 'video-container' 대상 요소에 삽입는 방식
                                mirror: false,          // 로컬 비디오를 미러링할지 여부
                            });

                            // --- 6) 스트림 게시하기 ---

                            mySession.publish(publisher);

                            // 현재 사용 중인 비디오 장치 가져오기
                            var devices = await this.OV.getDevices();
                            var videoDevices = devices.filter(device => device.kind === 'videoinput');
                            var currentVideoDeviceId = publisher.stream.getMediaStream().getVideoTracks()[0].getSettings().deviceId;
                            var currentVideoDevice = videoDevices.find(device => device.deviceId === currentVideoDeviceId);

                            // 웹캠을 표시하는 페이지의 메인 비디오를 설정하고 게시자를 저장합니다.
                            this.setState({
                                currentVideoDevice: currentVideoDevice,
                                mainStreamManager: publisher,
                                publisher: publisher,
                            });
                        })
                        .catch((error) => {
                            console.log('세션에 연결하는 중 오류가 발생했습니다:', error.code, error.message);
                        });
                });
            },
        );
    }


    leaveSession() {

        // --- 7) Session 객체를 통해 'disconnect' 메서드를 호출하여 세션을 종료합니다 ---

        const mySession = this.state.session;

        if (mySession) {
            mySession.disconnect();
        }

        // 모든 속성을 초기화합니다...
        this.OV = null;
        this.setState({
            session: undefined,
            subscribers: [],
            mySessionId: 'SessionA',
            myUserName: 'Participant' + Math.floor(Math.random() * 100),
            mainStreamManager: undefined,
            publisher: undefined
        });
    }

    async switchCamera() {
        try {
            const devices = await this.OV.getDevices()
            var videoDevices = devices.filter(device => device.kind === 'videoinput');

            if (videoDevices && videoDevices.length > 1) {

                var newVideoDevice = videoDevices.filter(device => device.deviceId !== this.state.currentVideoDevice.deviceId)

                if (newVideoDevice.length > 0) {
                    // 특정 videoSource로 새로운 publisher 생성
                    // 모바일 기기에서는 기본적으로 첫 번째 카메라가 전면 카메라입니다
                    var newPublisher = this.OV.initPublisher(undefined, {
                        videoSource: newVideoDevice[0].deviceId,
                        publishAudio: true,
                        publishVideo: true,
                        mirror: true
                    });

                    //newPublisher.once("accessAllowed", () => {
                    await this.state.session.unpublish(this.state.mainStreamManager)

                    await this.state.session.publish(newPublisher)
                    this.setState({
                        currentVideoDevice: newVideoDevice[0],
                        mainStreamManager: newPublisher,
                        publisher: newPublisher,
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    render() {
        const mySessionId = this.state.mySessionId;
        const myUserName = this.state.myUserName;

        return (
            <div className="container">
                {this.state.session === undefined ? (
                    <div id="join">
                        <div id="img-div">
                            <img src="resources/images/openvidu_grey_bg_transp_cropped.png" alt="OpenVidu logo" />
                        </div>
                        <div id="join-dialog" className="jumbotron vertical-center">
                            <h1> Join a video session </h1>
                            <form className="form-group" onSubmit={this.joinSession}>
                                <p>
                                    <label>Participant: </label>
                                    <input
                                        className="form-control"
                                        type="text"
                                        id="userName"
                                        value={myUserName}
                                        onChange={this.handleChangeUserName}
                                        required
                                    />
                                </p>
                                <p>
                                    <label> Session: </label>
                                    <input
                                        className="form-control"
                                        type="text"
                                        id="sessionId"
                                        value={mySessionId}
                                        onChange={this.handleChangeSessionId}
                                        required
                                    />
                                </p>
                                <p className="text-center">
                                    <input className="btn btn-lg btn-success" name="commit" type="submit" value="JOIN" />
                                </p>
                            </form>
                        </div>
                    </div>
                ) : null}

                {this.state.session !== undefined ? (
                    <div id="session">
                        <div id="session-header">
                            <h1 id="session-title">{mySessionId}</h1>
                            <input
                                className="btn btn-large btn-danger"
                                type="button"
                                id="buttonLeaveSession"
                                onClick={this.leaveSession}
                                value="Leave session"
                            />
                            <input
                                className="btn btn-large btn-success"
                                type="button"
                                id="buttonSwitchCamera"
                                onClick={this.switchCamera}
                                value="Switch Camera"
                            />
                        </div>

                        {this.state.mainStreamManager !== undefined ? (
                            <div id="main-video" className="col-md-6">
                                <UserVideoComponent streamManager={this.state.mainStreamManager} />

                            </div>
                        ) : null}
                        <div id="video-container" className="col-md-6">
                            {this.state.publisher !== undefined ? (
                                <div className="stream-container col-md-6 col-xs-6" onClick={() => this.handleMainVideoStream(this.state.publisher)}>
                                    <UserVideoComponent
                                        streamManager={this.state.publisher} />
                                </div>
                            ) : null}
                            {this.state.subscribers.map((sub, i) => (
                                <div key={sub.id} className="stream-container col-md-6 col-xs-6" onClick={() => this.handleMainVideoStream(sub)}>
                                    <span>{sub.id}</span>
                                    <UserVideoComponent streamManager={sub} />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }


//  * 토큰 및 세션을 얻기 위한 애플리케이션 서버와의 통신
//  * 아래의 메서드들은 애플리케이션 서버에서 세션과 토큰 생성을 요청합니다.
//  * 이렇게 하면 OpenVidu 배포가 안전게 유지됩니다.
//  *
//  * 이 샘플 코드에서는 사용자 제어가 전혀 없습니다. 누구나
//  * 애플리케이션 서버 엔드포에 액세스 할 수 있습니다! 실제 제품
//  * 환경에서 애플리케이션 서버는 사용자를 식별하여
//  * 엔드포인에 액세스하도록 해 합니다.
//  *
//  * https://docs.openvidu.io/en/stable/application-server에서 참조
//  * 애플리케이션 서버에서 OpenVidu 통합에 대해 자세히 알아보세요.
    async getToken() {
        const sessionId = await this.createSession(this.state.mySessionId);
        return await this.createToken(sessionId);
    }

    async createSession(sessionId) {
        const response = await axios.post(APPLICATION_SERVER_URL + 'api/sessions', { customSessionId: sessionId }, {
            headers: { 'Content-Type': 'application/json', },
        });
        return response.data; // The sessionId
    }

    async createToken(sessionId) {
        const response = await axios.post(APPLICATION_SERVER_URL + 'api/sessions/' + sessionId + '/connections', {}, {
            headers: { 'Content-Type': 'application/json', },
        });
        return response.data; // The token
    }
}

export default App;
