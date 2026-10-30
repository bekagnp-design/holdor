/* v1.3.7: the founder number. The first hundred players ever get "Founder #N" under their name on the home. The number is the player's real
   place in the order of signing up, read from the server (founder_no); it is asked once per session and kept in ACC.fno. Guests and everyone
   after the hundredth see nothing. */
const FND={asked:false};
function founderTag(){
  if(ACC&&ACC.fno>0&&ACC.fno<=100)return ` · <b class="fnd">Founder #${ACC.fno}</b>`;
  if(!FND.asked&&typeof CLOUD!=='undefined'&&CLOUD.on&&CLOUD.token){FND.asked=true;
    ecoRpc('founder_no',{},8000).then(n=>{if(typeof n==='number'&&n>0&&n<=100&&ACC){ACC.fno=n;persist();const el=document.querySelector('.who small');if(el&&!el.querySelector('.fnd'))el.insertAdjacentHTML('beforeend',founderTag());}}).catch(()=>{});}
  return '';}
