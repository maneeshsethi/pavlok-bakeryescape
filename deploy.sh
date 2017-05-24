#!/bin/bash

if [ $# -lt 1 ]
then
	echo "You must provide a commit message."
	exit 1	
fi
git add --all
git commit -m "$1"
git push heroku master

