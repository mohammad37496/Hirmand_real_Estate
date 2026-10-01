import { CustomerCallbackDialog } from "./customer-callback-dialog";
import { CustomerChatPanel } from "./customer-chat-panel";
import { CustomerPushSettings } from "./customer-push-settings";

export function CustomerEngagement({propertyId,propertyTitle}:{propertyId?:string;propertyTitle?:string}) {
  return (
    <div className="customer-engagement-layer">
      <CustomerChatPanel propertyId={propertyId} propertyTitle={propertyTitle}/>
      <CustomerCallbackDialog propertyId={propertyId} propertyTitle={propertyTitle}/>
      <CustomerPushSettings/>
    </div>
  );
}
