export async function load(url,context,nextLoad){
 if(/\.(png|jpg|svg|webp|css)$/.test(new URL(url).pathname))return {format:'module',source:'export default '+JSON.stringify(url)+';',shortCircuit:true};
 return nextLoad(url,context);
}
