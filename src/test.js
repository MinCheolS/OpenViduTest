import React, { useState, useEffect, useCallback, useRef } from "react";
import { OpenVidu } from "openvidu-browser";
import axios from "axios";
import "./App.css";
import UserVideoComponent from "./UserVideoComponent";

const APPLICATION_SERVER_URL =
  process.env.NODE_ENV === "production" ? "" : "https://demos.openvidu.io/";

const App = () => {
  const [mySessionId, setMySessionId] = useState("SessionA");
  const [myUserName, setMyUserName] = useState(
    "Participant" + Math.floor(Math.random() * 100)
  );
  const [session, setSession] = useState(undefined);
  const [mainStreamManager, setMainStreamManager] = useState(undefined);
  const [publisher, setPublisher] = useState(undefined);
  const [subscribers, setSubscribers] = useState([]);
  const [currentVideoDevice, setCurrentVideoDevice] = useState(null);
  const OV = useRef(null);

  useEffect(() => {
    const handler = () => leaveSession();
    window.addEventListener("beforeunload", handler);

    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, []);

  const onbeforeunload = useCallback(
    (event) => {
      leaveSession();
    },
    [leaveSession]
  );

  const handleChangeSessionId = useCallback((e) => {
    setMySessionId(e.target.value);
  }, []);

  const handleChangeUserName = useCallback((e) => {
    setMyUserName(e.target.value);
  }, []);

  const handleMainVideoStream = useCallback((stream) => {
    if (mainStreamManager !== stream) {
      setMainStreamManager(stream);
    }
  }, []);

  const deleteSubscriber = useCallback(
    (streamManager) => {
      const subscribersCopy = [...subscribers];
      const index = subscribersCopy.indexOf(streamManager);
      if (index > -1) {
        subscribersCopy.splice(index, 1);
        setSubscribers(subscribersCopy);
      }
    },
    [subscribers]
  );

  const createSession = async () => {
    try {
      const sessionId = mySessionId;
      const response = await axios.get(
        APPLICATION_SERVER_URL + "api/sessions/" + sessionId,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      return response.data.id;
    } catch (error) {
      console.error("인터넷 요청이 실패했습니다: createSession");
    }
  };

  const createToken = async (sessionId) => {
    try {
      const response = await axios.get(
        APPLICATION_SERVER_URL + "api/tokens/" + sessionId,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      return response.data.token;
    } catch (error) {
      console.error("인터넷 요청이 실패했습니다: createToken");
    }
  };

  const getToken = async () => {
    try {
      const sessionId = await createSession();
      const response = await createToken(sessionId);
      return response;
    } catch (error) {
      console.error("인터넷 요청이 실패했습니다: getToken");
    }
  };

  const joinSession = useCallback(async () => {
    const token = await getToken();

    OV.current = new OpenVidu();
    setSession(OV.current.initSession());

    const publisher = OV.current.initPublisher(undefined, {
      audioSource: undefined,
      videoSource: currentVideoDevice,
      publishAudio: true,
      publishVideo: true,
      resolution: "640x480",
      frameRate: 30,
      insertMode: "APPEND",
      mirror: false,
    });

    setPublisher(publisher);

    setMainStreamManager({
      ...publisher.stream,
      nickname: myUserName,
    });
    
    session.on("streamCreated", (event) => {
      const subscriber = session.subscribe(event.stream, undefined);
      var subs = subscribers;
      subs.push({
        ...subscriber,
        nickname: event.stream.connection.data.split('%')[0]
      });
      setSubscribers([...subs]);
    });

    session.on("streamDestroyed", (event) => {
      deleteSubscriber(event.stream.streamManager);
    });

    session
      .connect(token, myUserName)
      .then(() => {
        session.publish(publisher);
        setCurrentVideoDevice(publisher.videoSource.deviceId);
        console.log("참가자가 세션에 참여했습니다");
      })
      .catch((error) => {
        console.error("세션에 참가하지 못했습니다: ", error);
      });
  }, [
    mySessionId,
    myUserName,
    session,    
  ]);

  const leaveSession = useCallback(() => {
    if(session == undefined)return ; 
    const myUser = session.connection;
    const publisher = myUser.publishers[0];

    if (publisher) {
      publisher.stream.dispose();
    }

    if (session) {
      session.disconnect();
    }

      setSubscribers([]);
      setPublisher(null);
      setMainStreamManager(null);
      setSession(null);

      console.log("참가자가 세션을 떠났습니다");

  }, [session]);

  const switchCamera = useCallback(async () => {
    const device = await (async () => {
      const devices = await OV.current.getDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
      const currentDevice = videoDevices.find(
        (device) => device.deviceId === currentVideoDevice
      );
      const index = videoDevices.indexOf(currentDevice);
      if (index < videoDevices.length - 1) {
        return videoDevices[index + 1].deviceId;
      }
      return videoDevices[0].deviceId;
    })();

    setCurrentVideoDevice(device);

    const updatedPublisher = OV.current.initPublisher(undefined, {
      videoSource: device,
      publishAudio: publisher.stream.audioActive,
      publishVideo: publisher.stream.videoActive,
    });

    updatedPublisher.once("accessAllowed", () => {
      session.unpublish(publisher);
      publisher.dispose();
      setPublisher(updatedPublisher);
      setMainStreamManager(updatedPublisher.stream);
      setCurrentVideoDevice(device);
      session.publish(updatedPublisher).catch((error) => {
        console.log("카메라를 변경할 수 없음", error);
      });
    });
  }, [OV, session, mainStreamManager]);

  return (
    <div className="container-fluid text-center m-4">
      <label for="name">이름 :</label>
      <input
        id="name"
        onChange={handleChangeUserName}
        value={myUserName}
        disabled={!!session}
        className=""
      />
      <label for="session-id">세션 ID :</label>
      <input
        id="session-id"
        onChange={handleChangeSessionId}
        value={mySessionId}
        disabled={!!session}
      />
      <button
        id="join-button"
        className="waves-effect waves-light btn btn-block"
        onClick={() => joinSession()}
        disabled={!!session}
      >
        세션 참여
      </button>
      <button
        id="leave-button"
        className="waves-effect waves-light btn btn-block"
        onClick={() => leaveSession()}
        disabled={!session}
      >
        세션 떠나기
      </button>
      {!!mainStreamManager && (
        <div id="session" className="rounded">
          <UserVideoComponent
            streamManager={mainStreamManager}
            handleMainVideoStream={handleMainVideoStream}
          />
          <div
            id="main-video-div"
            className="video-container vide"
            onMouseOver={() => console.log("mouse over main video div")}
          >
            {!!publisher && (
              <div className="">
                {!!publisher.videoSource && (
                  <button
                    className="waves-effect waves-light btn"
                    onClick={() => switchCamera()}
                  >
                    카메라 변경
                  </button>
                )}
              </div>
            )}
            {
              <div
                ref={mainVideoComponentRef}
                id="remoteVideos"
                className="row d-flex flex-row flex-nowrap"
              >
                {subscribers.map((sub) => (
                  <UserVideoComponent
                    key={sub.stream.connection.connectionId}
                    streamManager={sub.stream}
                    handleMainVideoStream={handleMainVideoStream}
                  />
                ))}
              </div>
            }
          </div>
        </div>
      )}
    </div>
  );
};

export default App;