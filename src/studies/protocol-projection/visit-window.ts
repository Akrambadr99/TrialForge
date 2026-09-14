export interface TimeWindowDecision{inside:boolean;earlyBy:number;lateBy:number}
export function visitWindow(value:number,opens:number,closes:number):TimeWindowDecision{if(![value,opens,closes].every(Number.isFinite)||opens>closes)throw new Error('Invalid Visit windows boundary.');return{inside:value>=opens&&value<=closes,earlyBy:Math.max(0,opens-value),lateBy:Math.max(0,value-closes)}}
