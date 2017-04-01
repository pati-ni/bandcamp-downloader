const https = require('https');
const http = require('http');
const fs = require('fs');
const parse5 = require('parse5');
const sanitize = require("sanitize-filename");
const mkdirp = require('mkdirp');
const id3 = require('id3-writer');

var page = fs.createWriteStream("page.html");
var url = "https://larrywish.bandcamp.com/album/porous-obtainer-of-loads-truly-bald";

var prefix;
var folder_name;

//Global Metadata
var album;
var artist;
var year;
var thumbnail;
var genre; //TBD



function child_iterate(obj){

    if (obj.childNodes instanceof Object && !(obj.childNodes == null) ){
	obj.childNodes.forEach( (child) => {
	    child_iterate(child);
	});
    }else{
	if(obj.parentNode.attrs != null && obj.parentNode.attrs.length != 0){
	    var attrs = obj.parentNode.attrs[0];
	    if(attrs['value']=='text/javascript'){
		//console.log(obj['value'].length);
		obj['value'].split('};').forEach((segment)=>{
		    var s =12;
		    var str = segment.trim().substring(0,s);
		    if(str=='var TralbumData'.substring(0,s)){
			process_album_data(segment+'};');
		    }else if(str=='var EmbedData'.substring(0,s)){
			console.log('Found Album Title');
			eval(segment+'};');
			album = EmbedData['album_title'];
			artist = EmbedData['artist'];
			var date = new Date(EmbedData['embed_info']['public_embeddable']);
			year = date.getFullYear();
			folder_name=artist+" - "+ album+" ("+year+")";
			mkdirSync(folder_name);
			prefix = folder_name;	
		    }
		});
	    }
	}
    }
}

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function fix_metadata(file,track){
    var metadata={
	'artist':artist,
	'title':track['title'],
	'album':album,
	'year':year,
	'track':track['track_num']
    };
    var writer = new id3.Writer();
    var mp3 = new id3.File(file);
    //var coverImage = new id3.Image(prefix+'/'+thumbnail);
    //var meta = new id3.Meta(metadata,[coverImage]);
    var meta = new id3.Meta(metadata);
    writer.setFile(mp3).write(meta, function(err) {
	if (err) {
            console.error(err);
	}else{
	    console.log("Finished with:",file);
	}
    });
    //console.log(metadata);
}
function get_image(url,filename){
    var file = fs.createWriteStream(prefix+"/"+filename);
    file.on('open', (fd)=>{
	https.get(url, (response) => {
	    console.log('Picture URL:',url);
	    //console.log('Status ', response.statusCode);
	    if(response.statusCode==302){
		var new_url = response.headers.location;
		console.log('Redirecting: ',response.headers.location);
		get_image(new_url);
	    }else if(response.statusCode==200){
		//console.log('Headers:',response.headers);
		response.on('data', (data) =>{
		    file.write(data);
		}).on('end',()=>{
		    file.end();
		    thumbnail=filename;
		});
	    }else{
		console.log('Invalid Status ', response.statusCode);
	    }
	}).on('error', (e) => {
	    console.error(e);
	});
    });    
}

function get_track_file(track,url){
    
    var filename = pad(track['track_num'],2)+' - '+track['title']+'.mp3';
    var path = prefix+"/"+sanitize(filename);
    var file = fs.createWriteStream(path);
    file.on('open', (fd)=>{
	http.get(url, (response) => {
	    console.log('URL:',url);
	    //console.log('Status ', response.statusCode);
	    if(response.statusCode==302){
		var new_url = response.headers.location;
		console.log('Redirecting: ',response.headers.location);
		get_track_file(track,new_url);
	    }else if(response.statusCode==200){
		//console.log('Headers:',response.headers);
		response.on('data', (data) =>{
		    file.write(data);
		}).on('end',()=>{
		    file.end();
		    fix_metadata(path,track);
		});
	    }else{
		console.log('Invalid Status ', response.statusCode);
	    }
	}).on('error', (e) => {
	    console.error(e);
	});
    });
}



function process_album_data(obj){
    eval(obj);
    //console.log(TralbumData);
    album_info = TralbumData;
    //get_image(album_info['artThumbURL'], 'thumbnail.jpg');
    //get_image(album_info['artFullsizeUrl'],'cover.jpg');
    
    album_info['trackinfo'].forEach((track)=>{
	var url = 'http:'+track['file']['mp3-128'];
	get_track_file(track,url);
    });

}


function get_https_root(url){
    var parser = new parse5.ParserStream();
    https.get(url, (response) => {
	console.log('Status ', response.statusCode);
	//console.log('Headers:',response.headers);
	response.setEncoding('utf8');
	response.pipe(parser);
	parser.on('finish', () =>{
	    child_iterate(parser.document);
	});
    }).on('error', (e) => {
	console.error(e);
    });

}


var mkdirSync = function (path) {
    try {
	fs.mkdirSync(path);
    } catch(e) {
	if ( e.code != 'EEXIST' ) throw e;
    }
}

//mkdirSync(prefix);
get_https_root(url);
