# 
# @file: Makefile
# @author: arik abuhasira (arikabuhasira@gmail.com)
#
# project typescript compile. 
# 

SRCDIR =src
TSC_FLAGS = -m commonjs -t ES5 

JS =   mzi.js 	\
	   app.js 	\
	   httpsrv.js
			  
			  

all:   $(JS)
	
%.js: %.ts
	tsc $(TSC_FLAGS) $<     --sourcemap
	
clean: 
	rm -rf  $(JS) *.map 
	rm -rf  *~
