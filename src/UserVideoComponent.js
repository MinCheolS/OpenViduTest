// import React, { Component } from 'react';
// import OpenViduVideoComponent from './OvVideo';
// import './UserVideo.css';

// export default class UserVideoComponent extends Component {

//     getNicknameTag() {
//         // 사용자의 닉네임을 가져옵니다.
//         return JSON.parse(this.props.streamManager.stream.connection.data).clientData;
//     }

//     render() {
//         return (
//             <div>
//                 {this.props.streamManager !== undefined ? (
//                     <div className="streamcomponent">
//                         <OpenViduVideoComponent streamManager={this.props.streamManager} />
//                         <div><p>{this.getNicknameTag()}</p></div>
//                     </div>
//                 ) : null}
//             </div>
//         );
//     }
// }
import React from 'react';
import OpenViduVideoComponent from './OvVideo';
import './UserVideo.css';

const UserVideoComponent = ({ streamManager }) => {
    const getNicknameTag = () => {
        // 사용자의 닉네임을 가져옵니다.
        return JSON.parse(streamManager.stream.connection.data).clientData;
    };

    return (
        <div>
            {streamManager !== undefined ? (
                <div className="streamcomponent">
                    <OpenViduVideoComponent streamManager={streamManager} />
                    <div><p>{getNicknameTag()}</p></div>
                </div>
            ) : null}
        </div>
    );
};

export default UserVideoComponent;

