import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { createHash } from "crypto";

if (!process.env.WSAPI_URL) {
  throw new Error("Initialisation Error: WSAPI_URL not set");
}

const wsBroadcast = new ApiGatewayManagementApiClient({
  endpoint: process.env.WSAPI_URL,
});

interface EventBridgeEvent {
  source: string;
  "detail-type": string;
  detail: Notification;
}

interface PersonConnection {
  name: string;
  connectionId: string;
}

interface Notification {
  name: string;
  allPeople: Array<PersonConnection>;
}

export async function broadcast(event: EventBridgeEvent) {
  try {
    const { name, allPeople } = event.detail;

    const allNames = allPeople.map(({ name, connectionId }) => {
      const hash = createHash("sha1");
      hash.update(connectionId);
      return { name, id: hash.digest("hex") };
    });
    const payload = Buffer.from(JSON.stringify({
      event: event["detail-type"],
      name,
      allPeople: allNames
    }));

    await Promise.all(
      allPeople.map(({ connectionId }) => {
        console.log(connectionId);
        return wsBroadcast.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: payload,
          })
        );
      })
    );
    return {
      statusCode: 204,
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: e instanceof Error ? e.message : e,
    };
  }
}
